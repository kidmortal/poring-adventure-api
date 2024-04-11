import { Injectable } from '@nestjs/common';
import * as OneSignal from '@onesignal/node-onesignal';

@Injectable()
export class OneSignalNotificationService {
  private configuration = OneSignal.createConfiguration({
    userKey: process.env.ONESIGNAL_USER_KEY,
    appKey: process.env.ONESIGNAL_APP_KEY,
  });
  private client = new OneSignal.DefaultApi(this.configuration);
  private app: OneSignal.App;

  constructor() {
    this.client
      .getApp(process.env.ONESIGNAL_APP_ID)
      .then((app) => (this.app = app));
  }

  async sendPushNotification(args: { message: string }) {
    const notification = new OneSignal.Notification();
    notification.app_id = this.app.id;
    notification.name = 'test_notification_name';
    notification.headings = {
      en: "Gig'em Ags",
    };
    notification.contents = {
      en: args.message,
      pt: args.message,
    };
    notification.included_segments = ['All'];
    const result = await this.client.createNotification(notification);
    console.log(result);
  }
}
