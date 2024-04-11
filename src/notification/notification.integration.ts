import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as Sentry from '@sentry/node';

@Injectable()
export class OneSignalNotificationService {
  private logger = new Logger('Onesignal - service');

  private client = axios.create({
    baseURL: 'https://onesignal.com/api/v1/notifications',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${process.env.ONESIGNAL_APP_KEY}`,
    },
  });

  constructor() {}

  async sendPushNotification(args: { message: string }) {
    const result = await this.client.post('', {
      name: 'test_notification_name',
      headings: { en: "Gig'em Ags" },
      contents: {
        en: args.message,
        pt: args.message,
      },
      included_segments: ['All'],
    });
    console.log(result);
  }

  async sendPushNotificationToUser(args: {
    userEmail: string;
    message: string;
  }) {
    try {
      await this.client.post('', {
        app_id: process.env.ONESIGNAL_APP_ID,
        name: `Notification for ${args.userEmail}`,
        headings: { en: `Custom Notification` },
        target_channel: 'push',
        contents: {
          en: args.message,
          pt: args.message,
        },
        include_aliases: { external_id: [args.userEmail] },
      });
      this.logger.debug(`Notification sent to ${args.userEmail}`);
    } catch (error) {
      Sentry.captureException(error);
      this.logger.warn(error.response.data.errors);
    }
  }
}
