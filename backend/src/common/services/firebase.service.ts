import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private messaging: any = null;
  private ready = false;

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn(
        'Firebase not configured — push notifications disabled. ' +
        'Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY to enable.',
      );
      return;
    }

    try {
      const { initializeApp, getApps, cert } = await import('firebase-admin/app');
      const { getMessaging } = await import('firebase-admin/messaging');

      if (!getApps().length) {
        initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
        });
      }

      this.messaging = getMessaging();
      this.ready = true;
      this.logger.log('Firebase Admin SDK initialized — push notifications enabled');
    } catch (err: any) {
      this.logger.error(`Firebase init failed: ${err.message}`);
    }
  }

  async sendToTokens(
    tokens: string[],
    notification: { title: string; body: string },
    data?: Record<string, string>,
  ): Promise<{ successCount: number; failureCount: number; invalidTokens: string[] }> {
    if (!this.ready || !tokens.length) {
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    const invalidTokens: string[] = [];
    let successCount = 0;
    let failureCount = 0;

    const BATCH = 500;
    for (let i = 0; i < tokens.length; i += BATCH) {
      const batch = tokens.slice(i, i + BATCH);
      try {
        const response = await this.messaging.sendEachForMulticast({
          tokens: batch,
          notification,
          data,
          android: { priority: 'high' },
          apns: { payload: { aps: { sound: 'default' } } },
        });
        successCount += response.successCount;
        failureCount += response.failureCount;
        (response.responses as any[]).forEach((r: any, idx: number) => {
          if (!r.success) {
            const code: string = r.error?.code ?? '';
            if (
              code === 'messaging/invalid-registration-token' ||
              code === 'messaging/registration-token-not-registered'
            ) {
              invalidTokens.push(batch[idx]);
            }
          }
        });
      } catch (err: any) {
        this.logger.error(`FCM batch send failed: ${err.message}`);
        failureCount += batch.length;
      }
    }

    return { successCount, failureCount, invalidTokens };
  }

  isReady() {
    return this.ready;
  }
}
