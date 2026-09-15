import { Module } from '@nestjs/common';
import { GymSubscriptionsService } from './gym-subscriptions.service';
import { GymSubscriptionsController } from './gym-subscriptions.controller';
import { AdminGymSubscriptionsController } from './admin-gym-subscriptions.controller';
import { SubscriptionExpiryService } from './subscription-expiry.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [GymSubscriptionsController, AdminGymSubscriptionsController],
  providers: [GymSubscriptionsService, SubscriptionExpiryService],
  exports: [GymSubscriptionsService],
})
export class GymSubscriptionsModule {}
