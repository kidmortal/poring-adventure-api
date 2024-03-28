import { Injectable } from '@nestjs/common';
import { Mail } from '@prisma/client';
import { ItemsService } from 'src/items/items.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { TransactionContext } from 'src/prisma/types/prisma';
import { UsersService } from 'src/users/users.service';
import { WebsocketService } from 'src/websocket/websocket.service';

@Injectable()
export class MailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly websocket: WebsocketService,
    private readonly userService: UsersService,
    private readonly itemService: ItemsService,
  ) {}
  async findAll(args: { userEmail: string }) {
    return this._notifyUserMailBox(args);
  }

  async viewAll(args: { userEmail: string }) {
    const result = await this.prisma.mail.updateMany({
      where: { userEmail: args.userEmail, visualized: false },
      data: { visualized: true },
    });
    return result;
  }

  async claimAll(args: { userEmail: string }) {
    await this.prisma.$transaction(async (tx) => {
      const claimableMails = await tx.mail.findMany({
        where: { userEmail: args.userEmail, claimed: false },
      });
      for await (const mail of claimableMails) {
        await this._claimMail({ mail, tx });
      }
    });

    await this._notifyUserMailBox(args);
    await this.userService.notifyUserUpdateWithProfile({
      email: args.userEmail,
    });
    return true;
  }

  async deleteAll(args: { userEmail: string }) {
    const result = await this.prisma.mail.deleteMany({
      where: { userEmail: args.userEmail, claimed: true },
    });
    return result;
  }

  async _claimMail(args: { mail: Mail; tx: TransactionContext }) {
    const tx = args.tx || this.prisma;
    const mail = args.mail;
    if (mail) {
      if (mail.silver && mail.silver > 0) {
        await this.userService.addSilverToUser({
          userEmail: mail.userEmail,
          amount: mail.silver,
          tx,
        });
      }
      if (mail.itemId && mail.itemStack && mail.itemStack > 0) {
        await this.itemService.addItemToUser({
          userEmail: mail.userEmail,
          itemId: mail.itemId,
          stack: mail.itemStack,
          tx,
        });
      }
      await tx.mail.update({
        where: { id: mail.id },
        data: { claimed: true, visualized: true },
      });
    }
  }
  async _notifyUserMailBox(args: { userEmail: string }) {
    const mailBox = await this.prisma.mail.findMany({
      where: { userEmail: args.userEmail },
      include: { item: true },
    });

    if (mailBox) {
      this.websocket.sendMessageToSocket({
        event: 'mailbox',
        email: args.userEmail,
        payload: mailBox,
      });
      return true;
    }
  }
}
