import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../common/services/push.service';

const NOTIFICATION_RETENTION_DAYS = 90;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private push: PushService,
  ) {}

  async findAll(userId: string, opts: { limit?: number; cursor?: string } = {}) {
    const take = Math.min(opts.limit ?? 50, 100);
    const cursor = opts.cursor ? { id: opts.cursor } : undefined;

    const items = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor, skip: 1 } : {}),
    });

    const hasMore = items.length > take;
    const data = hasMore ? items.slice(0, take) : items;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return { data, nextCursor, hasMore };
  }

  async markAsRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.userId !== userId) throw new ForbiddenException('Access denied');
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async create(data: {
    title: string;
    message: string;
    type: any;
    userId?: string;
    gymId?: string;
    channel?: any;
    metadata?: any;
  }) {
    const notification = await this.prisma.notification.create({ data: data as any });

    if (data.userId) {
      this.push.sendToUser(
        data.userId,
        { title: data.title, body: data.message },
        { notificationId: notification.id, type: String(data.type) },
      ).catch((err) => this.logger.error(`Push failed for user ${data.userId}: ${err.message}`));
    }

    return notification;
  }

  async broadcast(gymId: string, data: { title: string; message: string; type: any }) {
    if (!data.title?.trim()) throw new Error('Notification title is required');
    if (!data.message?.trim()) throw new Error('Notification message is required');

    const users = await this.prisma.user.findMany({
      where: { gymId, isActive: true },
      select: { id: true },
    });

    const batchSize = 50;
    let totalCreated = 0;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      const result = await this.prisma.notification.createMany({
        data: batch.map((u) => ({
          title: data.title.slice(0, 255),
          message: data.message.slice(0, 1000),
          type: data.type,
          userId: u.id,
          gymId,
          channel: 'IN_APP',
        })),
      });
      totalCreated += result.count;
    }

    // Send FCM push to all gym users (fire-and-forget)
    this.push.sendToGym(
      gymId,
      { title: data.title.slice(0, 255), body: data.message.slice(0, 1000) },
      { type: String(data.type) },
    ).catch((err) => this.logger.error(`Gym push broadcast failed: ${err.message}`));

    return { count: totalCreated };
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  @Cron(CronExpression.EVERY_WEEK)
  async cleanupOldNotifications() {
    const cutoff = new Date(Date.now() - NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    try {
      const result = await this.prisma.notification.deleteMany({
        where: { createdAt: { lt: cutoff }, isRead: true },
      });
      this.logger.log(`Notification cleanup: deleted ${result.count} read notifications older than ${NOTIFICATION_RETENTION_DAYS} days`);
    } catch (err) {
      this.logger.error(`Notification cleanup failed: ${err.message}`);
    }
  }
}
