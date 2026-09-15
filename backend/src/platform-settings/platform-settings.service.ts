import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';

export const SINGLETON_ID = 'singleton';
const CACHE_TTL_MS = 60_000;

export interface PlatformSettingsView {
  id: string;
  upiVpa: string | null;
  upiPayeeName: string | null;
  trialDays: number;
  graceDays: number;
  supportEmail: string | null;
  gstPct: number;
}

/**
 * Single-row platform configuration, chiefly the UPI VPA gyms pay us at.
 *
 * Env (`PLATFORM_UPI_VPA`, `PLATFORM_UPI_PAYEE_NAME`) only bootstraps the row
 * when it does not exist yet; after that the database is authoritative so the
 * payee can be changed without a redeploy — and every change is audited, which
 * matters for the one field an attacker would most want to edit.
 */
@Injectable()
export class PlatformSettingsService implements OnModuleInit {
  private readonly logger = new Logger(PlatformSettingsService.name);
  private cache: { value: PlatformSettingsView; expiresAt: number } | null = null;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private audit: AuditService,
  ) {}

  async onModuleInit() {
    try {
      const existing = await this.prisma.platformSettings.findUnique({ where: { id: SINGLETON_ID } });
      if (existing) return;
      await this.prisma.platformSettings.create({
        data: {
          id: SINGLETON_ID,
          upiVpa: this.config.get<string>('PLATFORM_UPI_VPA') ?? null,
          upiPayeeName: this.config.get<string>('PLATFORM_UPI_PAYEE_NAME') ?? 'ActiveBoost',
        },
      });
      this.logger.log('Platform settings row created');
    } catch (err) {
      // Never block boot on this — the settings endpoint can create it later.
      this.logger.warn(`Could not bootstrap platform settings: ${(err as Error).message}`);
    }
  }

  async get(): Promise<PlatformSettingsView> {
    if (this.cache && this.cache.expiresAt > Date.now()) return this.cache.value;

    const row =
      (await this.prisma.platformSettings.findUnique({ where: { id: SINGLETON_ID } })) ??
      (await this.prisma.platformSettings.create({ data: { id: SINGLETON_ID } }));

    const value: PlatformSettingsView = {
      id: row.id,
      upiVpa: row.upiVpa,
      upiPayeeName: row.upiPayeeName,
      trialDays: row.trialDays,
      graceDays: row.graceDays,
      supportEmail: row.supportEmail,
      gstPct: row.gstPct,
    };
    this.cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  }

  async update(dto: UpdatePlatformSettingsDto, user: any): Promise<PlatformSettingsView> {
    const before = await this.get();
    const row = await this.prisma.platformSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...dto, updatedByUserId: user?.id },
      update: { ...dto, updatedByUserId: user?.id },
    });
    this.cache = null;

    await this.audit.log({
      userId: user?.id,
      action: 'PLATFORM_SETTINGS_UPDATED',
      entity: 'PlatformSettings',
      entityId: SINGLETON_ID,
      oldValues: before as unknown as Record<string, unknown>,
      newValues: dto as unknown as Record<string, unknown>,
    });

    return this.get().then(() => ({
      id: row.id,
      upiVpa: row.upiVpa,
      upiPayeeName: row.upiPayeeName,
      trialDays: row.trialDays,
      graceDays: row.graceDays,
      supportEmail: row.supportEmail,
      gstPct: row.gstPct,
    }));
  }

  invalidate() {
    this.cache = null;
  }
}
