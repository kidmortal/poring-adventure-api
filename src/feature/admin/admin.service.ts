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
  async sendPushNotificationToUser(args: { userEmail: string; receiverEmail: string; message: string }) {
    await this.notification.sendPushNotificationToUser({
      title: 'Debug Message',
      message: args.message,
      userEmail: args.receiverEmail,
    });
    this.websocket.sendTextNotification({ email: args.userEmail, text: 'Push notification sent to user' });
    return true;
  }

  async disconnectUserSocket(args: { userEmail: string; disconnectEmail: string }) {
    this.websocket.breakUserConnection(args.disconnectEmail);
    this.websocket.sendTextNotification({ email: args.userEmail, text: 'You have disconnected a user' });
    return true;
  }

  async getConnectedUsers(args: { userEmail: string }) {
    await this._notifyWithConnectedUsers(args);
    return true;
  }

  async sendGiftMail(args: { userEmail: string; receiverEmail: string }) {
    await this.mailService.sendMail({
      senderName: 'Admin',
      receiverEmail: args.receiverEmail,
      content: 'System Gift',
      silver: 100,
    });
    await this.mailService._notifyUserMailBox(args);
    this.websocket.sendTextNotification({ email: args.userEmail, text: 'You have sent a gift to the user' });
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

  async fullHealUser(args: { userEmail: string; healEmail: string }) {
    await this.userService.incrementUserHealth({ userEmail: args.healEmail, amount: 9999 });
    await this.userService.incrementUserMana({ userEmail: args.healEmail, amount: 9999 });
    this.userService.notifyUserUpdateWithProfile({ email: args.healEmail });
    this.websocket.sendTextNotification({ email: args.userEmail, text: 'User has been Fully healed' });
    this.websocket.sendTextNotification({ email: args.healEmail, text: 'You got fully healed by an Admin' });
    this._notifyWithConnectedUsers(args);

    return true;
  }

  async killUser(args: { userEmail: string; killEmail: string }) {
    await this.userService.decrementUserHealth({ userEmail: args.killEmail, amount: 9999 });
    await this.userService.decrementUserMana({ userEmail: args.killEmail, amount: 9999 });
    this.userService.notifyUserUpdateWithProfile({ email: args.killEmail });
    this.websocket.sendTextNotification({ email: args.userEmail, text: 'User has been killed' });
    this.websocket.sendTextNotification({ email: args.killEmail, text: 'You got killed by an Admin' });
    this._notifyWithConnectedUsers(args);
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

  async _notifyWithConnectedUsers(args: { userEmail: string }) {
    const sockets = this.websocket.getAllSockets();
    const users = {};
    const integrations = [];

    for await (const socket of sockets) {
      const email = socket.email;
      if (!users[email] && email) {
        if (email != 'discord') {
          const user = await this.userService._getUserWithEmail({
            userEmail: socket.email,
          });
          users[email] = user;
        } else {
          integrations.push('discord');
        }
      }
    }
    this.websocket.sendMessageToSocket({
      email: args.userEmail,
      event: 'connected_users',
      payload: {
        users: Object.values(users),
        connectedSockets: sockets.length,
        integrations,
      },
    });
    return true;
  }
}
