import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SaaSStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { GymSubscriptionsService } from './gym-subscriptions.service';
import { isPrimaryInstance } from '../common/utils/cluster';

/**
 * One nudge, five days out. Sent once per subscription — `expiryReminderSentAt`
 * is what stops the daily sweep resending it every day inside the window.
 */
const REMINDER_DAYS_BEFORE = 5;

/**
 * Housekeeping only. `EntitlementsService` already treats a past endDate as
 * expired on read, so a missed run can never hand out access it shouldn't —
 * this just settles the stored rows and sends the reminders.
 */
@Injectable()
export class SubscriptionExpiryService {
  private readonly logger = new Logger(SubscriptionExpiryService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private platformSettings: PlatformSettingsService,
    private entitlements: EntitlementsService,
    private subscriptions: GymSubscriptionsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleCron() {
    // ScheduleModule is only registered on the primary worker, but this method
    // is also directly callable — belt and braces.
    if (!isPrimaryInstance()) return;
    await this.sweep();
  }

  async sweep() {
    // graceDays defaults to 0, so a plan goes inactive the day it expires.
    const { graceDays } = await this.platformSettings.get();
    const cutoff = new Date(Date.now() - graceDays * 86_400_000);

    const lapsed = await this.prisma.gymSubscription.findMany({
      where: { status: { in: [SaaSStatus.ACTIVE, SaaSStatus.TRIAL] }, endDate: { lt: cutoff } },
      select: { id: true, gymId: true },
    });

    for (const row of lapsed) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.gymSubscription.update({ where: { id: row.id }, data: { status: SaaSStatus.EXPIRED } });
          await this.subscriptions.syncGymCache(tx, row.gymId);
        });
        this.entitlements.invalidate(row.gymId);
        await this.notifyAdmins(row.gymId, 'Subscription expired', 'Your plan has expired. Renew it to restore full access.');
      } catch (err) {
        this.logger.error(`Failed to expire subscription ${row.id}: ${(err as Error).message}`);
      }
    }

    const reminded = await this.sendReminders();
    this.logger.log(`Subscription sweep: ${lapsed.length} expired, ${reminded} reminders sent`);
    return { expired: lapsed.length, reminded };
  }

  /**
   * Sends the one pre-expiry reminder. Anything already stamped is skipped, so
   * running the sweep twice in a day (or manually) never double-notifies.
   */
  private async sendReminders(): Promise<number> {
    const windowEnd = new Date();
    windowEnd.setDate(windowEnd.getDate() + REMINDER_DAYS_BEFORE);
    windowEnd.setHours(23, 59, 59, 999);

    const due = await this.prisma.gymSubscription.findMany({
      where: {
        status: { in: [SaaSStatus.ACTIVE, SaaSStatus.TRIAL] },
        expiryReminderSentAt: null,
        endDate: { gt: new Date(), lte: windowEnd },
      },
      select: { id: true, gymId: true, endDate: true, plan: { select: { name: true } } },
    });

    let sent = 0;
    for (const row of due) {
      const days = Math.max(0, Math.ceil((row.endDate.getTime() - Date.now()) / 86_400_000));
      await this.notifyAdmins(
        row.gymId,
        `Subscription expires in ${days} day${days === 1 ? '' : 's'}`,
        `Your ${row.plan.name} plan ends on ${row.endDate.toLocaleDateString('en-IN')}. Renew it to keep your plan features.`,
      );
      // Stamp after sending: a failed notification retries tomorrow rather than
      // being silently swallowed.
      await this.prisma.gymSubscription.update({
        where: { id: row.id },
        data: { expiryReminderSentAt: new Date() },
      });
      sent++;
    }
    return sent;
  }

  private async notifyAdmins(gymId: string, title: string, message: string) {
    try {
      const admins = await this.prisma.user.findMany({
        where: { gymId, role: 'GYM_ADMIN', isActive: true, deletedAt: null },
        select: { id: true },
      });
      await Promise.all(
        admins.map((a) => this.notifications.create({ userId: a.id, gymId, title, message, type: 'GENERAL' })),
      );
    } catch (err) {
      this.logger.warn(`Reminder failed for gym ${gymId}: ${(err as Error).message}`);
    }
  }
}
