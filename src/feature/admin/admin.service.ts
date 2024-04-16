import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { MailService } from 'src/feature/mail/mail.service';
import { NotificationService } from 'src/services/notification/notification.service';
import { UsersService } from 'src/feature/users/users.service';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import * as os from 'os';
import { execSync } from 'child_process';
import { memoryUsage } from 'process';

@Injectable()
export class AdminService {
  constructor(
    private readonly notification: NotificationService,
    private readonly websocket: WebsocketService,
    private readonly userService: UsersService,
    private readonly mailService: MailService,
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
    await this.notification.sendPushNotificationToUser({
      title: 'Debug Message',
      message: args.message,
      userEmail: args.userEmail,
    });
    return true;
  }

  async disconnectUserSocket(args: { userEmail: string }) {
    this.websocket.breakUserConnection(args.userEmail);
    return true;
  }

  async getConnectedUsers(args: { userEmail: string }) {
    const sockets = this.websocket.getAllSockets();
    const users = {};

    for await (const socket of sockets) {
      const email = socket.email;
      if (!users[email]) {
        const user = await this.userService._getUserWithEmail({
          userEmail: socket.email,
        });
        users[email] = user;
      }
    }
    this.websocket.sendMessageToSocket({
      email: args.userEmail,
      event: 'connected_users',
      payload: {
        users: Object.values(users),
        connectedSockets: sockets.length,
      },
    });
    return true;
  }

  async sendGiftMail(args: { userEmail: string }) {
    await this.mailService.sendMail({
      senderName: 'Admin',
      receiverEmail: args.userEmail,
      content: 'System Gift',
      silver: 100,
    });
    await this.mailService._notifyUserMailBox(args);
    return true;
  }

  async clearCache() {
    await this.cache.reset();
    return true;
  }

  async getServerInfo(args: { userEmail: string }) {
    const branchData = execSync('git rev-parse HEAD').toString();
    const branchHash = branchData.trim();
    const memoryInfo = this._getRamUsage();
    this.websocket.sendMessageToSocket({
      email: args.userEmail,
      event: 'server_info',
      payload: { branchHash, memoryInfo },
    });
    return true;
  }

  async restartServer() {
    execSync('pm2 restart poring-adventure');
    return true;
  }

  _getRamUsage() {
    const freeMemory = os.freemem();
    const totalMemory = os.totalmem();
    const appMemoryUsage = memoryUsage().rss;
    const totalMemoryUsage = totalMemory - freeMemory;
    return {
      totalMemory,
      appMemoryUsage,
      totalMemoryUsage,
    };
  }
}
