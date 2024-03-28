import { Injectable } from '@nestjs/common';
import { Notification as UserNofication } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { TransactionContext } from 'src/prisma/types/prisma';
import { UsersService } from 'src/users/users.service';
import { WebsocketService } from 'src/websocket/websocket.service';

@Injectable()
export class MailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly websocket: WebsocketService,
    private readonly user: UsersService,
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

  async viewAll(args: { userEmail: string }) {
    const result = await this.prisma.notification.updateMany({
      where: { userEmail: args.userEmail, visualized: false },
      data: { visualized: true },
    });
    return result;
  }

  async claimAll(args: { userEmail: string }) {
    await this.prisma.$transaction(async (tx) => {
      const claimableRewards = await tx.notification.findMany({
        where: { userEmail: args.userEmail, claimed: false },
      });
      for await (const reward of claimableRewards) {
      }
    });
  }

  async deleteAll(args: { userEmail: string }) {
    const result = await this.prisma.notification.deleteMany({
      where: { userEmail: args.userEmail, claimed: true },
    });
    return result;
  }

  async _claimReward(args: {
    notification: UserNofication;
    tx: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;
    const notif = args.notification;
    if (notif) {
      if (notif.silver) {
      }
    }
  }
}
