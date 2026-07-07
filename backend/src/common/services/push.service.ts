import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FirebaseService } from './firebase.service';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private prisma: PrismaService,
    private firebase: FirebaseService,
  ) {}

  async sendToUser(
    userId: string,
    notification: { title: string; body: string },
    data?: Record<string, string>,
  ) {
    if (!this.firebase.isReady()) return;

    const tokens = await this.prisma.pushToken.findMany({
      where: { userId, isActive: true },
      select: { token: true },
    });
    if (!tokens.length) return;

    const tokenStrings = tokens.map((t) => t.token);
    const result = await this.firebase.sendToTokens(tokenStrings, notification, data);

    if (result.invalidTokens.length) {
      await this.prisma.pushToken.updateMany({
        where: { token: { in: result.invalidTokens } },
        data: { isActive: false },
      });
      this.logger.log(`Deactivated ${result.invalidTokens.length} invalid push tokens for user ${userId}`);
    }

    return result;
  }

  async sendToGym(
    gymId: string,
    notification: { title: string; body: string },
    data?: Record<string, string>,
  ) {
    if (!this.firebase.isReady()) return;

    const users = await this.prisma.user.findMany({
      where: { gymId, isActive: true },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    if (!userIds.length) return;

    const tokens = await this.prisma.pushToken.findMany({
      where: { userId: { in: userIds }, isActive: true },
      select: { token: true, userId: true },
    });
    if (!tokens.length) return;

    const result = await this.firebase.sendToTokens(
      tokens.map((t) => t.token),
      notification,
      data,
    );

    if (result.invalidTokens.length) {
      await this.prisma.pushToken.updateMany({
        where: { token: { in: result.invalidTokens } },
        data: { isActive: false },
      });
    }

    this.logger.log(`Gym broadcast push to ${gymId}: ${result.successCount} sent, ${result.failureCount} failed`);
    return result;
  }
}
