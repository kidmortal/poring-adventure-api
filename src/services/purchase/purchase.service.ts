import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { RevenueCatPurchaseWebhook } from './entities/purchase.entity';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { RevenueCatService } from './revenuecat.service';
import { NotificationService } from 'src/services/notification/notification.service';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { MailService } from 'src/feature/mail/mail.service';

/** Shape returned to the client for every purchase action it can trigger. */
export type PurchaseActionResult = {
  success: boolean;
  message: string;
};

@Injectable()
export class PurchaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly revenuecat: RevenueCatService,
    private readonly notificationService: NotificationService,
    private readonly websocket: WebsocketService,
    private readonly mailService: MailService,
  ) {}
  private readonly logger = new Logger('Purchase');

  /** Entry point for RevenueCat server webhooks. */
  async webhook(args: { purchase: RevenueCatPurchaseWebhook }) {
    const event = args.purchase?.event;
    if (!event?.type) {
      throw new BadRequestException('No type has been passed');
    }
    const email = event.subscriber_attributes?.$email?.value;
    const { type, transaction_id: transactionId, product_id: productId, app_user_id: appUserId } = event;

    switch (type) {
      case 'NON_RENEWING_PURCHASE':
        this.logger.warn(`Receiving purchase ${transactionId}`);
        return this._registerPurchase({ appUserId, productId, email, transactionId });
      case 'CANCELLATION':
        this.logger.warn(`Cancel purchase ${transactionId}`);
        return this._cancelPurchase({ transactionId, email });
      case 'TEST':
        return 'Webhook received';
      default:
        throw new BadRequestException(`Unsupported webhook type ${type}`);
    }
  }

  /** Lists the purchases of a user, and pushes the same list over the socket. */
  async findAll(args: { userEmail: string }) {
    const purchases = await this._getAllUserPurchases(args);
    this.websocket.sendMessageToSocket({
      event: 'purchases',
      email: args.userEmail,
      payload: purchases,
    });
    return purchases;
  }

  findOne(args: { userEmail: string; purchaseId: number }) {
    return this.prisma.userPurchase.findUnique({
      where: { id: args.purchaseId, userEmail: args.userEmail },
      include: { product: true },
    });
  }

  /** Asks RevenueCat to refund a purchase that the player has not claimed yet. */
  async requestRefund(args: { userEmail: string; purchaseId: number }): Promise<PurchaseActionResult> {
    const purchase = await this._getUserPurchase(args);
    if (purchase.received) {
      throw new BadRequestException('Purchase already claimed');
    }
    if (purchase.refunded) {
      throw new BadRequestException('Purchase is already being refunded');
    }

    const refunded = await this.revenuecat.refundPurchase({
      transactionId: purchase.transactionId,
      appUserId: purchase.appUserId,
    });
    if (!refunded) {
      return this._fail({ userEmail: args.userEmail, message: 'Could not refund this purchase' });
    }

    await this.prisma.userPurchase.update({
      where: { id: purchase.id },
      data: { refunded: true },
    });
    await this.findAll({ userEmail: args.userEmail });
    return this._succeed({ userEmail: args.userEmail, message: 'Purchase refund requested' });
  }

  /**
   * Delivers the product rewards to the player.
   * Rewards are sent through the mailbox so the player keeps a claimable record,
   * and the purchase is flagged as received in the same transaction.
   */
  async claimPurchase(args: { userEmail: string; purchaseId: number }): Promise<PurchaseActionResult> {
    const purchase = await this._getUserPurchase(args);
    if (purchase.received) {
      throw new BadRequestException('Purchase already claimed');
    }
    if (purchase.refunded) {
      return this._fail({ userEmail: args.userEmail, message: 'Purchase is being refunded' });
    }

    const userHasTransaction = await this.revenuecat.userHasTransaction({
      appUserId: purchase.appUserId,
      transactionId: purchase.transactionId,
    });
    if (!userHasTransaction) {
      this.logger.warn(`Purchase ${purchase.transactionId} is not owned by ${purchase.appUserId}, cancelling it`);
      await this._cancelPurchase({ email: args.userEmail, transactionId: purchase.transactionId });
      return this._fail({ userEmail: args.userEmail, message: 'This purchase is not available' });
    }

    const { product } = purchase;
    // Flag first and only deliver when this call is the one that flipped it,
    // so a double click can never hand out the rewards twice.
    const claim = await this.prisma.userPurchase.updateMany({
      where: { id: purchase.id, received: false },
      data: { received: true },
    });
    if (claim.count === 0) {
      throw new BadRequestException('Purchase already claimed');
    }

    await this.mailService.sendMail({
      receiverEmail: args.userEmail,
      senderName: 'Store',
      content: `Thank you for purchasing ${product.displayName}`,
      silver: product.silver,
      itemId: product.itemId ?? undefined,
      itemStack: product.itemId ? product.itemStack : undefined,
    });

    this.logger.log(`Purchase ${purchase.transactionId} claimed by ${args.userEmail}`);
    await this.mailService.findAll({ userEmail: args.userEmail });
    await this.findAll({ userEmail: args.userEmail });
    return this._succeed({
      userEmail: args.userEmail,
      message: `${product.displayName} has been sent to your mailbox`,
    });
  }

  private async _getUserPurchase(args: { userEmail: string; purchaseId: number }) {
    const purchase = await this.findOne(args);
    if (!purchase) {
      throw new NotFoundException(`No purchase found with id ${args.purchaseId}`);
    }
    return purchase;
  }

  private async _cancelPurchase(args: { transactionId: string; email: string }) {
    const purchase = await this.prisma.userPurchase.findUnique({
      where: { transactionId: args.transactionId },
    });
    if (!purchase) {
      return 'No transaction found to cancel';
    }

    const result = await this.prisma.userPurchase.delete({
      where: { transactionId: args.transactionId },
    });
    this.logger.warn(`Cancel purchase id ${args.transactionId} email: ${args.email}`);
    await this.notificationService.sendPushNotificationToUser({
      userEmail: args.email,
      title: 'Purchase Cancel',
      message: 'Your purchase has been canceled',
    });
    await this.findAll({ userEmail: args.email });
    return result;
  }

  private async _registerPurchase(args: {
    productId: string;
    appUserId: string;
    transactionId: string;
    email: string;
  }) {
    const product = await this.prisma.storeProduct.findUnique({
      where: { name: args.productId },
    });
    if (!product) {
      throw new BadRequestException(`No product registered with id ${args.productId}`);
    }
    const existingPurchase = await this.prisma.userPurchase.findUnique({
      where: { transactionId: args.transactionId },
    });
    if (existingPurchase) {
      throw new BadRequestException('Purchase already registered');
    }

    const result = await this.prisma.userPurchase.create({
      data: {
        transactionId: args.transactionId,
        appUserId: args.appUserId,
        userEmail: args.email,
        storeProductId: product.id,
      },
      include: { product: true },
    });
    this.logger.warn(`Purchase id ${args.transactionId} email: ${args.email}`);
    await this.notificationService.sendPushNotificationToUser({
      userEmail: args.email,
      title: 'Purchase successful',
      message: 'Check your store purchases to claim your items',
    });
    await this.findAll({ userEmail: args.email });
    return result;
  }

  private _getAllUserPurchases(args: { userEmail: string }) {
    return this.prisma.userPurchase.findMany({
      where: { userEmail: args.userEmail },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private _succeed(args: { userEmail: string; message: string }): PurchaseActionResult {
    this.websocket.sendTextNotification({ email: args.userEmail, text: args.message });
    return { success: true, message: args.message };
  }

  private _fail(args: { userEmail: string; message: string }): PurchaseActionResult {
    this.websocket.sendErrorNotification({ email: args.userEmail, text: args.message });
    return { success: false, message: args.message };
  }
}
