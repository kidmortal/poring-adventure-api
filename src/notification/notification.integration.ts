import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as Sentry from '@sentry/node';

@Injectable()
export class OneSignalNotificationService {
  private logger = new Logger('Onesignal - service');

  private client = axios.create({
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${process.env.ONESIGNAL_APP_KEY}`,
    },
  });

  constructor() {
    setTimeout(() => {
      this.addTagToSubscription({
        userEmail: 'kidmortal@gmail.com',
        key: 'guild',
        value: '1',
      });
    }, 3000);
  }

  async sendPushNotification(args: { message: string }) {
    const success = await this._postNotification({
      body: {
        app_id: process.env.ONESIGNAL_APP_ID,
        name: 'test_notification_name',
        headings: { en: "Gig'em Ags" },
        small_icon: 'notification_icon',
        large_icon: 'notification_icon',
        contents: {
          en: args.message,
          pt: args.message,
        },
        included_segments: ['All'],
      },
    });
    if (success) {
      this.logger.debug(`Notification sent to all users`);
    }
  }

  async sendPushNotificationToUser(args: {
    userEmail: string;
    title: string;
    message: string;
  }) {
    const success = await this._postNotification({
      body: {
        app_id: process.env.ONESIGNAL_APP_ID,
        name: `Notification for ${args.userEmail}`,
        headings: { en: args.title },
        target_channel: 'push',
        small_icon: 'notification_icon',
        large_icon: 'notification_icon',
        contents: {
          en: args.message,
          pt: args.message,
        },
        include_aliases: { external_id: [args.userEmail] },
      },
    });
    if (success) {
      this.logger.debug(`Notification sent to ${args.userEmail}`);
    }
  }

  async _postNotification(args: { body: object }): Promise<boolean> {
    try {
      await this.client.post(
        'https://onesignal.com/api/v1/notifications',
        args.body,
      );
      return true;
    } catch (error) {
      Sentry.captureException(error);
      this.logger.warn(error.response.data.errors);
      return false;
    }
  }
  async _getSubscription(args: { userEmail: string }) {
    try {
      const data = await this.client.get(
        `https://api.onesignal.com/apps/${process.env.ONESIGNAL_APP_ID}/users/by/external_id/${args.userEmail}`,
      );
      return data;
    } catch (error) {
      Sentry.captureException(error);
      this.logger.warn(error.response.data.errors);
      return;
    }
  }

  async _updateSubscription(args: { userEmail: string; body: object }) {
    try {
      const data = await this.client.patch(
        `https://api.onesignal.com/apps/${process.env.ONESIGNAL_APP_ID}/users/by/external_id/${args.userEmail}`,
        args.body,
      );
      return data;
    } catch (error) {
      Sentry.captureException(error);
      this.logger.warn(error.response.data.errors);
      return;
    }
  }

  async addTagToSubscription(args: {
    userEmail: string;
    key: string;
    value: string;
  }) {
    await this._updateSubscription({
      userEmail: args.userEmail,
      body: {
        properties: {
          tags: { [args.key]: args.value },
        },
      },
    });
  }

  async removeTagFromSubscription(args: { userEmail: string; key: string }) {
    await this._updateSubscription({
      userEmail: args.userEmail,
      body: {
        properties: {
          tags: { [args.key]: '' },
        },
      },
    });
  }

  async sendPushNotificationToTag(args: {
    title: string;
    message: string;
    tagKey: string;
    tagValue: string;
  }) {
    const success = await this._postNotification({
      body: {
        app_id: process.env.ONESIGNAL_APP_ID,
        name: `Notification for tag ${args.tagKey} ${args.tagValue}`,
        headings: { en: args.title },
        target_channel: 'push',
        small_icon: 'notification_icon',
        large_icon: 'notification_icon',
        contents: {
          en: args.message,
          pt: args.message,
        },
        filters: [
          {
            field: 'tag',
            key: args.tagKey,
            value: args.tagValue,
            relation: '=',
          },
        ],
      },
    });
    if (success) {
      this.logger.debug(
        `Notification sent to tag ${args.tagKey} ${args.tagValue}`,
      );
    }
  }
}
