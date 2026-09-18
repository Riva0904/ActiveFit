import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { PushService } from '../common/services/push.service';

/**
 * "You haven't been to the gym" reminders.
 *
 * Every piece of this existed already — `GET /attendance/inactive-members`,
 * `NotificationType.WINBACK`, the push service, stored device tokens — but
 * nothing ever fired them. `POST /users/:id/send-winback` was manual only, so in
 * practice a member who stopped coming was never nudged.
 *
 * Escalates once at each threshold and then stops: a daily "we miss you" is how
 * an app gets muted.
 */
@Injectable()
export class InactivityRemindersService {
  private readonly logger = new Logger(InactivityRemindersService.name);

  /** Days absent at which a member is nudged. After the last one, silence. */
  private readonly THRESHOLDS = [3, 7];

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly pushService: PushService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendDailyReminders() {
    this.logger.log('Running daily inactivity reminders...');
    await this.runForAllGyms();
  }

  async runForAllGyms() {
    const gyms = await this.prisma.gym.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });

    let total = 0;
    for (const gym of gyms) {
      try {
        total += await this.runForGym(gym.id);
      } catch (err: any) {
        this.logger.error(`Inactivity reminders failed for gym ${gym.id}: ${err?.message}`);
      }
    }
    this.logger.log(`Inactivity reminders sent: ${total}`);
    return total;
  }

  async runForGym(gymId: string): Promise<number> {
    const now = new Date();
    const maxThreshold = Math.max(...this.THRESHOLDS);

    // Only members with an active subscription: nudging someone whose membership
    // lapsed is a renewal problem, and renewal reminders already cover it.
    const members = await this.prisma.member.findMany({
      where: {
        gymId,
        deletedAt: null,
        user: { isActive: true },
        memberSubscriptions: { some: { status: 'ACTIVE', endDate: { gte: now } } },
      },
      select: {
        id: true,
        joinDate: true,
        lastAttendanceDate: true,
        weeklyGoal: true,
        user: { select: { id: true, firstName: true } },
      },
    });

    let sent = 0;
    for (const member of members) {
      const since = member.lastAttendanceDate ?? member.joinDate;
      const daysAbsent = Math.floor((now.getTime() - since.getTime()) / 86400000);

      // Past the last threshold we go quiet rather than nagging forever.
      if (daysAbsent < this.THRESHOLDS[0] || daysAbsent > maxThreshold) continue;

      // The highest threshold they have crossed.
      const threshold = [...this.THRESHOLDS].reverse().find((t) => daysAbsent >= t);
      if (!threshold) continue;

      // De-duplication without another column: a reminder only counts if it was
      // sent *after* their last visit, so coming back resets the sequence.
      const alreadySent = await this.prisma.notification.findFirst({
        where: {
          userId: member.user.id,
          type: NotificationType.WINBACK,
          createdAt: { gt: since },
          metadata: { path: ['threshold'], equals: threshold },
        },
        select: { id: true },
      });
      if (alreadySent) continue;

      const title = threshold >= 7 ? 'We miss you at the gym' : 'Time to get back in';
      const message =
        threshold >= 7
          ? `It's been ${daysAbsent} days, ${member.user.firstName}. Even a short session gets the streak going again.`
          : `${member.user.firstName}, it's been ${daysAbsent} days since your last session. Fancy one today?`;

      try {
        await this.notificationsService.create({
          userId: member.user.id,
          gymId,
          type: NotificationType.WINBACK,
          title,
          message,
          metadata: { threshold, daysAbsent },
        });
        // Push is best-effort: no device registered is normal, not a failure.
        await this.pushService
          .sendToUser(member.user.id, { title, body: message }, { type: 'WINBACK' })
          .catch(() => {});
        sent++;
      } catch (err: any) {
        this.logger.error(`Failed inactivity reminder for member ${member.id}: ${err?.message}`);
      }
    }

    return sent;
  }

  /** What today's run would send, without sending it. */
  async preview(gymId: string) {
    const now = new Date();
    const members = await this.prisma.member.findMany({
      where: {
        gymId,
        deletedAt: null,
        user: { isActive: true },
        memberSubscriptions: { some: { status: 'ACTIVE', endDate: { gte: now } } },
      },
      select: {
        id: true,
        joinDate: true,
        lastAttendanceDate: true,
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const maxThreshold = Math.max(...this.THRESHOLDS);
    return members
      .map((m) => {
        const since = m.lastAttendanceDate ?? m.joinDate;
        const daysAbsent = Math.floor((now.getTime() - since.getTime()) / 86400000);
        const threshold = [...this.THRESHOLDS].reverse().find((t) => daysAbsent >= t);
        if (!threshold || daysAbsent > maxThreshold) return null;
        return {
          memberId: m.id,
          name: `${m.user.firstName} ${m.user.lastName}`,
          daysAbsent,
          threshold,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.daysAbsent - a.daysAbsent);
  }
}
