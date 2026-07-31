import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { OneSignalNotificationService } from './notification.integration';

@Module({
  exports: [NotificationService],
  providers: [NotificationService, OneSignalNotificationService],
})
export class NotificationModule {}
