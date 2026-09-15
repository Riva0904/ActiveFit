import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SaaSPlan, SaaSStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { SaasPlansService } from '../saas-plans/saas-plans.service';
import { FEATURE_LABELS, featuresFor, type FeatureKey, type LimitKey } from './feature-catalogue';

const CACHE_TTL_MS = 60_000;

export interface EntitlementLimits {
  maxMembers: number;
  maxTrainers: number;
  maxStaff: number;
  maxBranches: number;
}

export interface Entitlement {
  gymId: string;
  plan: SaaSPlan;
  status: SaaSStatus;
  expiresAt: Date | null;
  /** Past endDate but still inside the grace window. */
  inGrace: boolean;
  /** ACTIVE, TRIAL, or expired-but-in-grace. */
  isActive: boolean;
  limits: EntitlementLimits;
  features: ReadonlySet<FeatureKey>;
}

export interface UsageCounts {
  members: number;
  trainers: number;
  staff: number;
  branches: number;
}

const LIMIT_FIELD: Record<LimitKey, keyof EntitlementLimits> = {
  members: 'maxMembers',
  trainers: 'maxTrainers',
  staff: 'maxStaff',
  branches: 'maxBranches',
};
const LIMIT_NOUN: Record<LimitKey, string> = {
  members: 'members',
  trainers: 'trainers',
  staff: 'staff members',
  branches: 'branches',
};

/**
 * The single answer to "what is this gym allowed to do".
 *
 * Resolution order matters: the GymSubscription row is authoritative, but we
 * fall back to the denormalized Gym columns because no live gym has a
 * subscription row yet — a subscription-only lookup would silently downgrade
 * every existing tenant the moment this ships.
 *
 * Expiry is recomputed on read, so a missed cron run can never over-grant.
 */
@Injectable()
export class EntitlementsService {
  private cache = new Map<string, { value: Entitlement; expiresAt: number }>();

  constructor(
    private prisma: PrismaService,
    private saasPlans: SaasPlansService,
    private platformSettings: PlatformSettingsService,
    private config: ConfigService,
  ) {}

  /**
   * New feature gates are opt-in per environment, because expenses, promo codes,
   * payroll and reports all ship free today and silently removing them from
   * existing tenants would be a regression, not a product change.
   */
  get featureEnforcementEnabled(): boolean {
    return this.config.get<string>('ENTITLEMENTS_ENFORCE_FEATURES') === 'true';
  }

  /**
   * Gates that already existed before entitlements and must keep working
   * regardless of the rollout flag — otherwise turning the flag off would hand
   * STARTER gyms a capability they never had.
   */
  private static readonly ALWAYS_ENFORCED: ReadonlyArray<FeatureKey> = ['PREMIUM_PACKAGES'];

  async getEntitlement(gymId: string): Promise<Entitlement> {
    const cached = this.cache.get(gymId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const value = await this.resolve(gymId);
    this.cache.set(gymId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  }

  private async resolve(gymId: string): Promise<Entitlement> {
    const { graceDays } = await this.platformSettings.get();

    const subscription = await this.prisma.gymSubscription.findFirst({
      where: { gymId, status: { in: [SaaSStatus.ACTIVE, SaaSStatus.TRIAL] } },
      orderBy: { endDate: 'desc' },
      include: { plan: true },
    });

    let plan: SaaSPlan;
    let status: SaaSStatus;
    let expiresAt: Date | null;
    let limits: EntitlementLimits;

    if (subscription) {
      plan = subscription.plan.plan;
      status = subscription.status;
      expiresAt = subscription.endDate;
      limits = {
        maxMembers: subscription.plan.maxMembers,
        maxTrainers: subscription.plan.maxTrainers,
        maxStaff: subscription.plan.maxStaff,
        maxBranches: subscription.plan.maxBranches,
      };
    } else {
      // Legacy path: every gym that predates subscriptions lands here.
      const gym = await this.prisma.gym.findUnique({
        where: { id: gymId },
        select: { saasPlan: true, saasStatus: true, saasExpiresAt: true },
      });
      plan = gym?.saasPlan ?? SaaSPlan.STARTER;
      status = gym?.saasStatus ?? SaaSStatus.TRIAL;
      expiresAt = gym?.saasExpiresAt ?? null;
      limits = await this.limitsForPlan(plan);
    }

    // Lazy expiry: the stored status is never trusted over the clock.
    let inGrace = false;
    if (expiresAt && expiresAt.getTime() < Date.now() && status !== SaaSStatus.CANCELLED) {
      const graceEnd = expiresAt.getTime() + graceDays * 86_400_000;
      inGrace = Date.now() <= graceEnd;
      status = SaaSStatus.EXPIRED;
    }

    const isActive = status === SaaSStatus.ACTIVE || status === SaaSStatus.TRIAL || inGrace;

    return { gymId, plan, status, expiresAt, inGrace, isActive, limits, features: featuresFor(plan) };
  }

  private async limitsForPlan(plan: SaaSPlan): Promise<EntitlementLimits> {
    const plans = await this.saasPlans.findAll();
    const row = plans.find((p: any) => p.plan === plan);
    return {
      maxMembers: row?.maxMembers ?? 0,
      maxTrainers: row?.maxTrainers ?? 0,
      maxStaff: row?.maxStaff ?? 0,
      maxBranches: row?.maxBranches ?? 0,
    };
  }

  /**
   * Never cached — a stale count would let a gym slip past its cap. Counts the
   * profile tables (not User) to match the limits that were enforced before.
   */
  async getUsage(gymId: string): Promise<UsageCounts> {
    const [members, trainers, staff, branches] = await Promise.all([
      this.prisma.member.count({ where: { gymId, deletedAt: null } }),
      this.prisma.trainer.count({ where: { gymId, deletedAt: null } }),
      this.prisma.staff.count({ where: { gymId, deletedAt: null } }),
      this.prisma.branch.count({ where: { gymId } }),
    ]);
    return { members, trainers, staff, branches };
  }

  async assertWithinLimit(gymId: string, key: LimitKey, delta = 1): Promise<void> {
    const [entitlement, usage] = await Promise.all([this.getEntitlement(gymId), this.getUsage(gymId)]);
    const max = entitlement.limits[LIMIT_FIELD[key]];
    if (!Number.isFinite(max) || max <= 0) return; // unconfigured tier: don't block

    if (usage[key] + delta > max) {
      // Message text is pinned by users.service tests and by frontend copy.
      throw new BadRequestException(
        `Your ${entitlement.plan} plan allows a maximum of ${max} ${LIMIT_NOUN[key]}. Please upgrade your plan.`,
      );
    }
  }

  async hasFeature(gymId: string, feature: FeatureKey): Promise<boolean> {
    const enforced = this.featureEnforcementEnabled || EntitlementsService.ALWAYS_ENFORCED.includes(feature);
    if (!enforced) return true;
    const entitlement = await this.getEntitlement(gymId);
    if (!entitlement.isActive) return false;
    return entitlement.features.has(feature);
  }

  async assertFeature(gymId: string, feature: FeatureKey): Promise<void> {
    if (await this.hasFeature(gymId, feature)) return;
    throw new ForbiddenException(`${FEATURE_LABELS[feature]} is not included in your plan. Please upgrade to continue.`);
  }

  async assertActive(gymId: string): Promise<void> {
    const entitlement = await this.getEntitlement(gymId);
    if (entitlement.isActive) return;
    throw new ForbiddenException('Your subscription has expired. Renew it to continue.');
  }

  invalidate(gymId?: string) {
    if (gymId) this.cache.delete(gymId);
    else this.cache.clear();
  }
}
