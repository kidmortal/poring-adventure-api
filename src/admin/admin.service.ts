import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { NotificationService } from 'src/notification/notification.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly notification: NotificationService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  async sendPushNotification(args: { message: string }) {
    await this.notification.sendPushNotification(args);
    return true;
  }

  async clearCache() {
    await this.cache.reset();
    return true;
  }
}
