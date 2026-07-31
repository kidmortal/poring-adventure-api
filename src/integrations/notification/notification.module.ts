import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { OneSignalNotificationService } from './onesignal.service';

@Module({
  exports: [NotificationService],
  providers: [NotificationService, OneSignalNotificationService],
})
export class NotificationModule {}
