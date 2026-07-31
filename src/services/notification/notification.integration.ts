import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as Sentry from '@sentry/node';

const ONESIGNAL_BASE_URL = 'https://api.onesignal.com';
const NOTIFICATION_ICON = 'notification_icon';

type NotificationTarget =
  | { included_segments: string[] }
  | { include_aliases: { external_id: string[] } }
  | { filters: object[] };

@Injectable()
export class OneSignalNotificationService {
  private readonly logger = new Logger('Onesignal - service');
  private readonly appId = process.env.ONESIGNAL_APP_ID;

  private readonly client = axios.create({
    baseURL: ONESIGNAL_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${process.env.ONESIGNAL_APP_KEY}`,
    },
  });

  /** Sends a notification to every subscribed device. */
  async sendPushNotification(args: { message: string; title?: string }) {
    const sent = await this._postNotification({
      name: 'Notification for all users',
      title: args.title ?? 'Poring Adventure',
      message: args.message,
      target: { included_segments: ['All'] },
    });
    if (sent) {
      this.logger.debug('Notification sent to all users');
    }
    return sent;
  }

  /** Sends a notification to the devices linked to a single user. */
  async sendPushNotificationToUser(args: { userEmail: string; title: string; message: string }) {
    const sent = await this._postNotification({
      name: `Notification for ${args.userEmail}`,
      title: args.title,
      message: args.message,
      target: { include_aliases: { external_id: [args.userEmail] } },
    });
    if (sent) {
      this.logger.debug(`Notification sent to ${args.userEmail}`);
    }
    return sent;
  }

  /** Sends a notification to every subscription carrying `tagKey: tagValue`. */
  async sendPushNotificationToTag(args: { title: string; message: string; tagKey: string; tagValue: string }) {
    const sent = await this._postNotification({
      name: `Notification for tag ${args.tagKey} ${args.tagValue}`,
      title: args.title,
      message: args.message,
      target: {
        filters: [{ field: 'tag', key: args.tagKey, value: args.tagValue, relation: '=' }],
      },
    });
    if (sent) {
      this.logger.debug(`Notification sent to tag ${args.tagKey} ${args.tagValue}`);
    }
    return sent;
  }

  addTagToSubscription(args: { userEmail: string; key: string; value: string }) {
    return this._setSubscriptionTags({
      userEmail: args.userEmail,
      tags: { [args.key]: args.value },
    });
  }

  /** OneSignal deletes a tag when it is sent with an empty value. */
  removeTagFromSubscription(args: { userEmail: string; key: string }) {
    return this._setSubscriptionTags({
      userEmail: args.userEmail,
      tags: { [args.key]: '' },
    });
  }

  async getSubscription(args: { userEmail: string }) {
    try {
      const response = await this.client.get(this._userUrl(args.userEmail));
      return response.data;
    } catch (error) {
      this._reportError(error, `Failed to load subscription for ${args.userEmail}`);
      return undefined;
    }
  }

  private async _setSubscriptionTags(args: { userEmail: string; tags: Record<string, string> }) {
    try {
      await this.client.patch(this._userUrl(args.userEmail), {
        properties: { tags: args.tags },
      });
      return true;
    } catch (error) {
      this._reportError(error, `Failed to update tags for ${args.userEmail}`);
      return false;
    }
  }

  private async _postNotification(args: { name: string; title: string; message: string; target: NotificationTarget }) {
    try {
      await this.client.post('/api/v1/notifications', {
        app_id: this.appId,
        name: args.name,
        headings: { en: args.title },
        target_channel: 'push',
        small_icon: NOTIFICATION_ICON,
        large_icon: NOTIFICATION_ICON,
        contents: { en: args.message, pt: args.message },
        ...args.target,
      });
      return true;
    } catch (error) {
      this._reportError(error, `Failed to send notification "${args.name}"`);
      return false;
    }
  }

  private _userUrl(userEmail: string) {
    return `/apps/${this.appId}/users/by/external_id/${encodeURIComponent(userEmail)}`;
  }

  private _reportError(error: unknown, context: string) {
    Sentry.captureException(error);
    const details = axios.isAxiosError(error) ? error.response?.data ?? error.message : error;
    this.logger.warn(`${context}: ${JSON.stringify(details)}`);
  }
}
