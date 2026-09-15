import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, SaasBillingPeriod, SaasPaymentStatus, SaaSStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import {
  CancelSubscriptionDto,
  ConfirmSaasPaymentDto,
  GrantSubscriptionDto,
  MarkSaasPaidDto,
  RejectSaasPaymentDto,
  RequestSubscriptionDto,
} from './dto/gym-subscription.dto';
import { addTerm, buildUpiIntentUrl, generateReferenceCode, termStart } from './subscription-term';

const OPEN_STATUSES: SaasPaymentStatus[] = [SaasPaymentStatus.AWAITING_PAYMENT, SaasPaymentStatus.SUBMITTED];

@Injectable()
export class GymSubscriptionsService {
  private readonly logger = new Logger(GymSubscriptionsService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notifications: NotificationsService,
    private platformSettings: PlatformSettingsService,
    private entitlements: EntitlementsService,
  ) {}

  // ─── Reads ────────────────────────────────────────────────────────────────

  /** Tier catalogue for buyers — commission and gateway ids are not their business. */
  async listPlansForGym() {
    const plans = await this.prisma.saaSSubscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { monthlyPrice: 'asc' },
    });
    return plans.map(({ commissionPct, razorpayPlanId, ...safe }) => safe);
  }

  async getMine(gymId: string) {
    const [entitlement, usage, subscription, pendingRequest] = await Promise.all([
      this.entitlements.getEntitlement(gymId),
      this.entitlements.getUsage(gymId),
      this.prisma.gymSubscription.findFirst({
        where: { gymId, status: { in: [SaaSStatus.ACTIVE, SaaSStatus.TRIAL] } },
        orderBy: { endDate: 'desc' },
        include: { plan: true },
      }),
      this.prisma.gymSubscriptionPayment.findFirst({
        where: { gymId, status: { in: OPEN_STATUSES } },
        orderBy: { createdAt: 'desc' },
        include: { plan: { select: { name: true, plan: true } } },
      }),
    ]);

    const daysLeft = entitlement.expiresAt
      ? Math.ceil((entitlement.expiresAt.getTime() - Date.now()) / 86_400_000)
      : null;

    return {
      plan: entitlement.plan,
      status: entitlement.status,
      isActive: entitlement.isActive,
      inGrace: entitlement.inGrace,
      expiresAt: entitlement.expiresAt,
      daysLeft,
      billingPeriod: subscription?.billingPeriod ?? null,
      source: subscription?.source ?? null,
      limits: entitlement.limits,
      usage,
      features: [...entitlement.features],
      pendingRequest,
    };
  }

  async history(gymId: string) {
    return this.prisma.gymSubscription.findMany({
      where: { gymId },
      orderBy: { createdAt: 'desc' },
      include: { plan: { select: { name: true, plan: true } } },
    });
  }

  async myRequests(gymId: string) {
    return this.prisma.gymSubscriptionPayment.findMany({
      where: { gymId },
      orderBy: { createdAt: 'desc' },
      include: { plan: { select: { name: true, plan: true } } },
    });
  }

  // ─── Gym admin: request → pay → wait ──────────────────────────────────────

  async request(gymId: string, userId: string, dto: RequestSubscriptionDto) {
    const settings = await this.platformSettings.get();
    if (!settings.upiVpa) {
      throw new BadRequestException('Online subscription payment is not configured yet — please contact support.');
    }

    const plan = await this.prisma.saaSSubscriptionPlan.findFirst({ where: { id: dto.planId, isActive: true } });
    if (!plan) throw new NotFoundException('Plan not found');

    const open = await this.prisma.gymSubscriptionPayment.findFirst({
      where: { gymId, status: { in: OPEN_STATUSES } },
    });
    if (open) {
      throw new ConflictException('You already have a subscription request in progress. Cancel it before starting another.');
    }

    // Price is always ours, never the client's.
    const amount = dto.billingPeriod === SaasBillingPeriod.YEARLY ? plan.yearlyPrice : plan.monthlyPrice;

    const record = await this.prisma.gymSubscriptionPayment.create({
      data: {
        gymId,
        planId: plan.id,
        billingPeriod: dto.billingPeriod,
        amount,
        referenceCode: await this.uniqueReferenceCode(),
        payeeVpa: settings.upiVpa,
        requestedByUserId: userId,
      },
      include: { plan: { select: { name: true, plan: true } } },
    });

    await this.audit.log({
      gymId,
      userId,
      action: 'SAAS_SUBSCRIPTION_REQUESTED',
      entity: 'GymSubscriptionPayment',
      entityId: record.id,
      newValues: { planId: plan.id, plan: plan.plan, billingPeriod: dto.billingPeriod, amount },
    });

    return {
      requestId: record.id,
      status: record.status,
      amount,
      currency: 'INR',
      plan: plan.plan,
      planName: plan.name,
      billingPeriod: dto.billingPeriod,
      vpa: settings.upiVpa,
      payeeName: settings.upiPayeeName ?? 'ActiveBoost',
      referenceCode: record.referenceCode,
      upiIntentUrl: buildUpiIntentUrl({
        vpa: settings.upiVpa,
        payeeName: settings.upiPayeeName ?? 'ActiveBoost',
        amount,
        note: record.referenceCode,
      }),
    };
  }

  async markPaid(gymId: string, requestId: string, dto: MarkSaasPaidDto) {
    const record = await this.prisma.gymSubscriptionPayment.findFirst({ where: { id: requestId, gymId } });
    if (!record) throw new NotFoundException('Subscription request not found');
    if (record.status === SaasPaymentStatus.CONFIRMED) return record;
    if (record.status !== SaasPaymentStatus.AWAITING_PAYMENT && record.status !== SaasPaymentStatus.SUBMITTED) {
      throw new BadRequestException(`This request is ${record.status.toLowerCase()} and can no longer be paid.`);
    }

    const updated = await this.prisma.gymSubscriptionPayment.update({
      where: { id: requestId },
      data: {
        status: SaasPaymentStatus.SUBMITTED,
        submittedAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
        upiReference: dto.upiReference ?? record.upiReference,
        notes: dto.notes ?? record.notes,
      },
    });

    await this.audit.log({
      gymId,
      action: 'SAAS_PAYMENT_SUBMITTED',
      entity: 'GymSubscriptionPayment',
      entityId: requestId,
      newValues: { upiReference: updated.upiReference },
    });

    return updated;
  }

  async cancelRequest(gymId: string, requestId: string) {
    const record = await this.prisma.gymSubscriptionPayment.findFirst({ where: { id: requestId, gymId } });
    if (!record) throw new NotFoundException('Subscription request not found');
    if (!OPEN_STATUSES.includes(record.status)) {
      throw new BadRequestException(`This request is ${record.status.toLowerCase()} and cannot be cancelled.`);
    }
    return this.prisma.gymSubscriptionPayment.update({
      where: { id: requestId },
      data: { status: SaasPaymentStatus.CANCELLED },
    });
  }

  // ─── Super admin: confirm / reject / grant / cancel ───────────────────────

  async pending() {
    return this.prisma.gymSubscriptionPayment.findMany({
      where: { status: SaasPaymentStatus.SUBMITTED },
      orderBy: { submittedAt: 'asc' },
      include: {
        plan: { select: { name: true, plan: true } },
        gym: { select: { id: true, name: true, email: true, phone: true, saasPlan: true } },
      },
    });
  }

  async listPayments(query: { status?: SaasPaymentStatus; gymId?: string; page?: number; limit?: number }) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 25, 100);
    const where: Prisma.GymSubscriptionPaymentWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.gymId) where.gymId = query.gymId;

    const [data, total] = await Promise.all([
      this.prisma.gymSubscriptionPayment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { plan: { select: { name: true, plan: true } }, gym: { select: { id: true, name: true } } },
      }),
      this.prisma.gymSubscriptionPayment.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async listSubscriptions(query: { gymId?: string; status?: SaaSStatus; page?: number; limit?: number }) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 25, 100);
    const where: Prisma.GymSubscriptionWhereInput = {};
    if (query.gymId) where.gymId = query.gymId;
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.gymSubscription.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { plan: { select: { name: true, plan: true } }, gym: { select: { id: true, name: true } } },
      }),
      this.prisma.gymSubscription.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  /**
   * Turn a submitted UPI payment into an active subscription.
   * Idempotent: a second confirm finds zero rows to move out of SUBMITTED and
   * returns the existing record instead of creating a duplicate term.
   */
  async confirm(requestId: string, dto: ConfirmSaasPaymentDto, actor: any) {
    const record = await this.prisma.gymSubscriptionPayment.findUnique({
      where: { id: requestId },
      include: { plan: true },
    });
    if (!record) throw new NotFoundException('Subscription request not found');
    if (record.status === SaasPaymentStatus.CONFIRMED) {
      return this.prisma.gymSubscriptionPayment.findUnique({ where: { id: requestId }, include: { subscription: true } });
    }
    if (record.status !== SaasPaymentStatus.SUBMITTED) {
      throw new BadRequestException(`Only submitted payments can be confirmed (this one is ${record.status.toLowerCase()}).`);
    }

    const now = dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      // Claim the row first — concurrent confirms lose here.
      const claimed = await tx.gymSubscriptionPayment.updateMany({
        where: { id: requestId, status: SaasPaymentStatus.SUBMITTED },
        data: {
          status: SaasPaymentStatus.CONFIRMED,
          confirmedAt: new Date(),
          confirmedByUserId: actor?.id,
          bankReference: dto.bankReference,
          notes: dto.notes ?? record.notes,
        },
      });
      if (claimed.count === 0) return null;

      const current = await tx.gymSubscription.findFirst({
        where: { gymId: record.gymId, status: { in: [SaaSStatus.ACTIVE, SaaSStatus.TRIAL] } },
        orderBy: { endDate: 'desc' },
        include: { plan: true },
      });

      const isSamePlan = current?.plan.plan === record.plan.plan;
      const startDate = termStart(now, current?.endDate ?? null, !!isSamePlan);
      const endDate = addTerm(startDate, record.billingPeriod);

      const subscription = await tx.gymSubscription.create({
        data: {
          gymId: record.gymId,
          planId: record.planId,
          status: SaaSStatus.ACTIVE,
          billingPeriod: record.billingPeriod,
          startDate,
          endDate,
          amount: record.amount,
          activatedAt: new Date(),
          source: 'UPI_MANUAL',
        },
      });

      // A plan change ends the old term; a renewal already stacked after it.
      if (current && !isSamePlan) {
        await tx.gymSubscription.update({
          where: { id: current.id },
          data: {
            status: SaaSStatus.CANCELLED,
            cancelledAt: new Date(),
            cancelReason: 'Superseded by a plan change',
            supersededById: subscription.id,
          },
        });
      } else if (current && isSamePlan) {
        await tx.gymSubscription.update({
          where: { id: current.id },
          data: { status: SaaSStatus.CANCELLED, cancelledAt: new Date(), cancelReason: 'Renewed', supersededById: subscription.id },
        });
      }

      await tx.gymSubscriptionPayment.update({ where: { id: requestId }, data: { subscriptionId: subscription.id } });
      await this.syncGymCache(tx, record.gymId);
      return subscription;
    });

    if (!result) {
      // Someone else confirmed it between our read and the claim.
      return this.prisma.gymSubscriptionPayment.findUnique({ where: { id: requestId }, include: { subscription: true } });
    }

    this.entitlements.invalidate(record.gymId);

    await this.audit.log({
      gymId: record.gymId,
      userId: actor?.id,
      action: 'SAAS_SUBSCRIPTION_CONFIRMED',
      entity: 'GymSubscription',
      entityId: result.id,
      newValues: { plan: record.plan.plan, amount: record.amount, startDate: result.startDate, endDate: result.endDate },
    });

    await this.notifyGymAdmins(
      record.gymId,
      'Subscription activated',
      `Your ${record.plan.name} plan is active until ${result.endDate.toLocaleDateString('en-IN')}.`,
    );

    return result;
  }

  async reject(requestId: string, dto: RejectSaasPaymentDto, actor: any) {
    const record = await this.prisma.gymSubscriptionPayment.findUnique({ where: { id: requestId }, include: { plan: true } });
    if (!record) throw new NotFoundException('Subscription request not found');
    if (record.status !== SaasPaymentStatus.SUBMITTED) {
      throw new BadRequestException(`Only submitted payments can be rejected (this one is ${record.status.toLowerCase()}).`);
    }

    const updated = await this.prisma.gymSubscriptionPayment.update({
      where: { id: requestId },
      data: {
        status: SaasPaymentStatus.REJECTED,
        rejectedAt: new Date(),
        rejectedByUserId: actor?.id,
        rejectionReason: dto.reason,
      },
    });

    await this.audit.log({
      gymId: record.gymId,
      userId: actor?.id,
      action: 'SAAS_SUBSCRIPTION_REJECTED',
      entity: 'GymSubscriptionPayment',
      entityId: requestId,
      newValues: { reason: dto.reason },
    });

    await this.notifyGymAdmins(
      record.gymId,
      'Subscription payment not confirmed',
      `We could not verify your payment for ${record.plan.name}: ${dto.reason}`,
    );

    return updated;
  }

  /** Comps, offline deals and make-goods. Same effect as a confirm, no payment row. */
  async grant(gymId: string, dto: GrantSubscriptionDto, actor: any) {
    const plan = await this.prisma.saaSSubscriptionPlan.findUnique({ where: { id: dto.planId } });
    if (!plan) throw new NotFoundException('Plan not found');
    const gym = await this.prisma.gym.findFirst({ where: { id: gymId, deletedAt: null } });
    if (!gym) throw new NotFoundException('Gym not found');

    const now = new Date();
    const subscription = await this.prisma.$transaction(async (tx) => {
      const current = await tx.gymSubscription.findFirst({
        where: { gymId, status: { in: [SaaSStatus.ACTIVE, SaaSStatus.TRIAL] } },
        orderBy: { endDate: 'desc' },
        include: { plan: true },
      });

      const isSamePlan = current?.plan.plan === plan.plan;
      const startDate = termStart(now, current?.endDate ?? null, !!isSamePlan);
      const endDate = addTerm(startDate, dto.billingPeriod, dto.months ?? 1);

      const created = await tx.gymSubscription.create({
        data: {
          gymId,
          planId: plan.id,
          status: SaaSStatus.ACTIVE,
          billingPeriod: dto.billingPeriod,
          startDate,
          endDate,
          amount: 0,
          activatedAt: now,
          source: 'SUPER_ADMIN_GRANT',
          grantedByUserId: actor?.id,
        },
      });

      if (current) {
        await tx.gymSubscription.update({
          where: { id: current.id },
          data: { status: SaaSStatus.CANCELLED, cancelledAt: now, cancelReason: dto.reason, supersededById: created.id },
        });
      }

      await this.syncGymCache(tx, gymId);
      return created;
    });

    this.entitlements.invalidate(gymId);

    await this.audit.log({
      gymId,
      userId: actor?.id,
      action: 'SAAS_SUBSCRIPTION_GRANTED',
      entity: 'GymSubscription',
      entityId: subscription.id,
      newValues: { plan: plan.plan, reason: dto.reason, endDate: subscription.endDate },
    });

    return subscription;
  }

  async cancel(subscriptionId: string, dto: CancelSubscriptionDto, actor: any) {
    const subscription = await this.prisma.gymSubscription.findUnique({ where: { id: subscriptionId } });
    if (!subscription) throw new NotFoundException('Subscription not found');

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.gymSubscription.update({
        where: { id: subscriptionId },
        data: {
          status: SaaSStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: dto.reason,
          ...(dto.immediate ? { endDate: new Date() } : {}),
        },
      });
      await this.syncGymCache(tx, subscription.gymId);
      return row;
    });

    this.entitlements.invalidate(subscription.gymId);

    await this.audit.log({
      gymId: subscription.gymId,
      userId: actor?.id,
      action: 'SAAS_SUBSCRIPTION_CANCELLED',
      entity: 'GymSubscription',
      entityId: subscriptionId,
      newValues: { reason: dto.reason, immediate: !!dto.immediate },
    });

    return updated;
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  /**
   * The ONLY writer of Gym.saasPlan/saasStatus/saasExpiresAt. Always called
   * inside the same transaction as the subscription write so the cache can
   * never drift from its authority.
   */
  async syncGymCache(tx: Prisma.TransactionClient, gymId: string) {
    const authoritative = await tx.gymSubscription.findFirst({
      where: { gymId, status: { in: [SaaSStatus.ACTIVE, SaaSStatus.TRIAL] } },
      orderBy: { endDate: 'desc' },
      include: { plan: true },
    });

    if (authoritative) {
      await tx.gym.update({
        where: { id: gymId },
        data: {
          saasPlan: authoritative.plan.plan,
          saasStatus: authoritative.status,
          saasExpiresAt: authoritative.endDate,
        },
      });
      return;
    }

    // No live term: mark expired but leave saasPlan so the UI can still say
    // which tier lapsed (and so a downgrade is never silently applied).
    const last = await tx.gymSubscription.findFirst({ where: { gymId }, orderBy: { endDate: 'desc' } });
    await tx.gym.update({
      where: { id: gymId },
      data: { saasStatus: SaaSStatus.EXPIRED, saasExpiresAt: last?.endDate ?? null },
    });
  }

  private async uniqueReferenceCode(): Promise<string> {
    for (let i = 0; i < 6; i++) {
      const code = generateReferenceCode();
      const clash = await this.prisma.gymSubscriptionPayment.findUnique({ where: { referenceCode: code } });
      if (!clash) return code;
    }
    return `AB-SUB-${Date.now().toString(36).toUpperCase()}`;
  }

  private async notifyGymAdmins(gymId: string, title: string, message: string) {
    try {
      const admins = await this.prisma.user.findMany({
        where: { gymId, role: 'GYM_ADMIN', isActive: true, deletedAt: null },
        select: { id: true },
      });
      await Promise.all(
        admins.map((a) => this.notifications.create({ userId: a.id, gymId, title, message, type: 'GENERAL' })),
      );
    } catch (err) {
      this.logger.warn(`Subscription notification failed for gym ${gymId}: ${(err as Error).message}`);
    }
  }
}
