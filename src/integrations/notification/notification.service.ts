import { Injectable } from '@nestjs/common';
import { OneSignalNotificationService } from './onesignal.service';

/**
 * Facade over the push notification provider, so the rest of the app never
 * depends on OneSignal directly — swapping providers only touches the integration.
 */
@Injectable()
export class NotificationService {
  constructor(private readonly notification: OneSignalNotificationService) {}

  sendPushNotification(args: { message: string; title?: string }) {
    return this.notification.sendPushNotification(args);
  }

  sendPushNotificationToUser(args: { userEmail: string; title: string; message: string }) {
    return this.notification.sendPushNotificationToUser(args);
  }

  sendPushNotificationToTag(args: { title: string; message: string; tagKey: string; tagValue: string }) {
    return this.notification.sendPushNotificationToTag(args);
  }

  addTagToSubscription(args: { userEmail: string; key: string; value: string }) {
    return this.notification.addTagToSubscription(args);
  }

  removeTagFromSubscription(args: { userEmail: string; key: string }) {
    return this.notification.removeTagFromSubscription(args);
  }
}
