import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { WebsocketService } from 'src/websocket/websocket.service';

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly websocket: WebsocketService,
  ) {}
  async findAll(params: { userEmail: string }) {
    const notifications = await this.prisma.notification.findMany({
      where: { userEmail: params.userEmail },
      include: { item: true },
    });

    if (notifications) {
      this.websocket.sendMessageToSocket({
        event: 'notification_list',
        email: params.userEmail,
        payload: notifications,
      });
      return true;
    }

    return false;
  }
}
