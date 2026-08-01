import { UserWalletService } from 'src/feature/users/userWallet.service';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Mail } from '@prisma/client';
import { InventoryService } from 'src/feature/items/inventory.service';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { TransactionContext } from 'src/core/prisma/types/prisma';
import { UsersService } from 'src/feature/users/users.service';
import { WebsocketService } from 'src/core/websocket/websocket.service';

@Injectable()
export class MailService {
  constructor(
    private readonly userWallet: UserWalletService,
    private readonly prisma: PrismaService,
    private readonly websocket: WebsocketService,
    private readonly userService: UsersService,
    private readonly inventory: InventoryService,
  ) {}
  private readonly logger = new Logger('Mail');
  async findAll(args: { userEmail: string }) {
    return this._notifyUserMailBox(args);
  }

  async viewAll(args: { userEmail: string }) {
    const result = await this.prisma.mail.updateMany({
      where: { userEmail: args.userEmail, visualized: false },
      data: { visualized: true },
    });
    this._notifyUserMailBox(args);
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
    this._notifyUserMailBox(args);
    return result;
  }

  async sendMail(args: {
    receiverEmail: string;
    senderName: string;
    content: string;
    silver?: number;
    itemId?: number;
    itemStack?: number;
  }) {
    await this.prisma.mail.create({
      data: {
        userEmail: args.receiverEmail,
        sender: args.senderName,
        content: args.content,
        silver: args.silver,
        itemId: args.itemId,
        itemStack: args.itemStack,
        visualized: false,
        claimed: false,
      },
    });
    return true;
  }

  /**
   * A gift from one player to another. It travels as mail, so the receiver
   * claims it like anything else, and nothing is skimmed on the way: what the
   * sender puts in is exactly what arrives.
   */
  async sendGift(args: {
    senderEmail: string;
    receiverEmail: string;
    silver?: number;
    inventoryId?: number;
    stack?: number;
    message?: string;
  }) {
    if (args.senderEmail === args.receiverEmail) {
      throw new BadRequestException('You cannot gift yourself');
    }

    const silver = Math.max(args.silver ?? 0, 0);
    const stack = Math.max(args.stack ?? 0, 0);
    const givesItem = !!args.inventoryId && stack > 0;
    if (!silver && !givesItem) {
      throw new BadRequestException('Put something in the gift first');
    }

    const [sender, receiver] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: args.senderEmail } }),
      this.prisma.user.findUnique({ where: { email: args.receiverEmail } }),
    ]);
    if (!receiver) {
      throw new BadRequestException('That player does not exist');
    }
    if (!sender || sender.silver < silver) {
      throw new BadRequestException('You are too poor for that');
    }

    // Equipped, locked and listed stacks are off limits, exactly as they are
    // for crafting and selling.
    let itemId: number | undefined;
    if (givesItem) {
      const owned = await this.prisma.inventoryItem.findUnique({
        where: { id: args.inventoryId, userEmail: args.senderEmail },
        include: { marketListing: true },
      });
      if (!owned) {
        throw new BadRequestException('You do not own that item');
      }
      if (owned.equipped || owned.locked || owned.marketListing) {
        throw new BadRequestException('That item is not free to give');
      }
      if (owned.stack < stack) {
        throw new BadRequestException(`You only have ${owned.stack} of those`);
      }
      itemId = owned.itemId;
    }

    await this.prisma.$transaction(async (tx) => {
      if (silver) {
        await this.userWallet.removeSilverFromUser({ userEmail: args.senderEmail, amount: silver, tx });
      }
      if (givesItem && args.inventoryId) {
        await this.inventory.removeItemFromInventory({
          userEmail: args.senderEmail,
          inventoryId: args.inventoryId,
          stack,
          tx,
        });
      }
      await tx.mail.create({
        data: {
          userEmail: args.receiverEmail,
          sender: sender.name,
          content: args.message?.trim() || `A gift from ${sender.name}`,
          silver,
          itemId,
          itemStack: givesItem ? stack : null,
          visualized: false,
          claimed: false,
        },
      });
    });

    this.logger.debug(`${args.senderEmail} gifted ${args.receiverEmail}`);
    await this._notifyUserMailBox({ userEmail: args.receiverEmail });
    await this.userService.notifyUserUpdateWithProfile({ email: args.senderEmail });
    return true;
  }

  async _claimMail(args: { mail: Mail; tx: TransactionContext }) {
    const tx = args.tx || this.prisma;
    const mail = args.mail;
    if (mail) {
      if (mail.silver && mail.silver > 0) {
        await this.userWallet.addSilverToUser({
          userEmail: mail.userEmail,
          amount: mail.silver,
          tx,
        });
      }
      if (mail.itemId && mail.itemStack && mail.itemStack > 0) {
        await this.inventory.addItemToInventory({
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
