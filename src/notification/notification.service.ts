import { Injectable } from '@nestjs/common';
import { OneSignalNotificationService } from './notification.integration';

@Injectable()
export class NotificationService {
  private notification = new OneSignalNotificationService();
  constructor() {}
  sendPushNotification(args: { message: string }) {
    return this.notification.sendPushNotification(args);
  }
  sendPushNotificationToUser(args: { userEmail: string; message: string }) {
    // todo
  }
}
