import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { MailService } from 'src/mail/mail.service';
import { NotificationService } from 'src/notification/notification.service';
import { UsersService } from 'src/users/users.service';
import { WebsocketService } from 'src/websocket/websocket.service';

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
    await this.notification.sendPushNotificationToUser(args);
    return true;
  }

  async disconnectUserSocket(args: { userEmail: string }) {
    this.websocket.breakUserConnection(args.userEmail);
    return true;
  }

  async getConnectedUsers() {
    const sockets = this.websocket.getAllSockets();
    const users = [];

    for await (const socket of sockets) {
      const user = await this.userService.findOne(socket.email);
      if (user) {
        users.push(user);
      }
    }
    return users;
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
}
