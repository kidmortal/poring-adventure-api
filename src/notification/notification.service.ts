import { Injectable } from '@nestjs/common';
import { OneSignalNotificationService } from './notification.integration';

@Injectable()
export class NotificationService {
  private notification = new OneSignalNotificationService();
  constructor() {}
  sendPushNotification(args: { message: string }) {
    return this.notification.sendPushNotification(args);
  }
  sendPushNotificationToUser(args: {
    userEmail: string;
    title: string;
    message: string;
  }) {
    return this.notification.sendPushNotificationToUser(args);
  }

  sendPushNotificationToTag(args: {
    title: string;
    message: string;
    tagKey: string;
    tagValue: string;
  }) {
    return this.notification.sendPushNotificationToTag(args);
  }

  addTagToSubscription(args: {
    userEmail: string;
    key: string;
    value: string;
  }) {
    return this.notification.addTagToSubscription(args);
  }
  removeTagFromSubscription(args: { userEmail: string; key: string }) {
    return this.notification.removeTagFromSubscription(args);
  }
}
