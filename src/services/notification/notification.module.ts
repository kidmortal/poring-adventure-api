import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';

@Module({
  exports: [NotificationService],
  providers: [NotificationService],
})
export class NotificationModule {}
