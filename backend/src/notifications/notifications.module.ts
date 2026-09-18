import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { InactivityRemindersService } from './inactivity-reminders.service';
import { NotificationsController } from './notifications.controller';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, InactivityRemindersService],
  exports: [NotificationsService, InactivityRemindersService],
})
export class NotificationsModule {}
