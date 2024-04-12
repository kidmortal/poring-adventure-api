import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { NotificationService } from 'src/notification/notification.service';
import { WebsocketService } from 'src/websocket/websocket.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly notification: NotificationService,
    private readonly websocket: WebsocketService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  async sendPushNotification(args: { message: string }) {
    await this.notification.sendPushNotification(args);
    return true;
  }
  async sendPushNotificationToUser(args: {
    userEmail: string;
    message: string;
  }) {
    await this.notification.sendPushNotificationToUser(args);
    return true;
  }

  async disconnectUserSocket(args: { userEmail: string }) {
    this.websocket.breakUserConnection(args.userEmail);
    return true;
  }

  async clearCache() {
    await this.cache.reset();
    return true;
  }
}
