import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { TransactionContext } from 'src/core/prisma/types/prisma';
import { WebsocketService } from 'src/core/websocket/websocket.service';

/** The kinds of event worth telling a player about after the fact. */
export type NotificationType = 'info' | 'hired_craft' | 'hired_enhance';

const MAX_STORED = 50;

/**
 * The activity log that sits next to the mailbox. Unlike mail there is nothing
 * to claim here: the silver and experience quoted were already paid when the
 * event happened, this only lets a player find out what they earned while they
 * were offline.
 */
@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly websocket: WebsocketService,
  ) {}
  private readonly logger = new Logger('Notifications');

  findAll(args: { userEmail: string }) {
    return this.prisma.notification.findMany({
      where: { userEmail: args.userEmail },
      orderBy: { createdAt: 'desc' },
      take: MAX_STORED,
    });
  }

  /**
   * Records an event and pushes the fresh list. Takes an optional transaction so
   * a job can log itself without the log outliving a rolled back job.
   */
  async notify(args: {
    userEmail: string;
    type: NotificationType;
    title: string;
    message: string;
    silver?: number;
    experience?: number;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;
    await tx.notification.create({
      data: {
        userEmail: args.userEmail,
        type: args.type,
        title: args.title,
        message: args.message,
        silver: args.silver ?? 0,
        experience: args.experience ?? 0,
      },
    });
    this.logger.debug(`${args.userEmail}: ${args.title}`);
    return true;
  }

  async readAll(args: { userEmail: string }) {
    await this.prisma.notification.updateMany({
      where: { userEmail: args.userEmail, read: false },
      data: { read: true },
    });
    await this.push(args);
    return true;
  }

  async deleteAll(args: { userEmail: string }) {
    await this.prisma.notification.deleteMany({ where: { userEmail: args.userEmail } });
    await this.push(args);
    return true;
  }

  /** Sends the current list to the user's sockets, if they are connected. */
  async push(args: { userEmail: string }) {
    const notifications = await this.findAll(args);
    this.websocket.sendMessageToSocket({
      event: 'notifications',
      email: args.userEmail,
      payload: notifications,
    });
    return true;
  }
}
