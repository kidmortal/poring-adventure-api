import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { RevenueCatPurchaseWebhook } from './entities/purchase.entity';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { RevenueCatService } from './revenuecat.service';
import { NotificationService } from 'src/services/notification/notification.service';
import { WebsocketService } from 'src/core/websocket/websocket.service';

@Injectable()
export class PurchaseService {
  private revenuecat = new RevenueCatService();
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly websocket: WebsocketService,
  ) {}
  private logger = new Logger('Purchase');
  async webhook(args: { purchase: RevenueCatPurchaseWebhook }) {
    const type = args.purchase?.event?.type;
    const email = args.purchase?.event?.subscriber_attributes?.$email?.value;
    const transactionId = args.purchase?.event?.transaction_id;
    const productId = args.purchase?.event?.product_id;
    const appUserId = args.purchase?.event?.app_user_id;
    if (type === 'NON_RENEWING_PURCHASE') {
      this.logger.warn(`Receiving purchase ${transactionId}`);
      return this._purchase({ appUserId, productId, email, transactionId });
    }
    if (type === 'CANCELLATION') {
      this.logger.warn(`Cancel purchase ${transactionId}`);
      return this._cancelPurchase({ transactionId, email });
    }

    if (type === 'TEST') {
      return 'hello world lol';
    }
    throw new BadRequestException('No type has been passed');
  }

  async findAll(args: { userEmail: string }) {
    await this._notifyUserWithPurchases(args);
    return true;
  }

  async requestRefund(args: { userEmail: string; purchaseId: number }) {
    const purchase = await this.prisma.userPurchase.findUnique({
      where: { id: args.purchaseId, userEmail: args.userEmail },
    });
    if (!purchase) {
      throw new BadRequestException(
        `No purchase found with id ${args.purchaseId}`,
      );
    }
    if (purchase.received) {
      throw new BadRequestException('Purchase already claimed');
    }
    const cancel = await this.revenuecat.refundPurchase({
      transactionId: purchase.transactionId,
      appUserId: purchase.appUserId,
    });
    if (cancel) {
      await this.prisma.userPurchase.update({
        where: { id: purchase.id },
        data: { refunded: true },
      });
      return true;
    }

    return false;
  }

  async claimPurchase(args: { userEmail: string; purchaseId: number }) {
    const purchase = await this.prisma.userPurchase.findUnique({
      where: { id: args.purchaseId, userEmail: args.userEmail },
    });

    const userHasTransaction = await this.revenuecat.userHasTransaction({
      appUserId: purchase.appUserId,
      transactionId: purchase.transactionId,
    });
    if (userHasTransaction) {
      if (purchase.refunded) {
        this.websocket.sendTextNotification({
          email: args.userEmail,
          text: 'Purchase being refunded',
        });
        return false;
      }
      this.websocket.sendTextNotification({
        email: args.userEmail,
        text: 'Not implemented Yet',
      });
      return true;
    } else {
      this.websocket.sendErrorNotification({
        email: args.userEmail,
        text: 'This Purchase is not available',
      });
      this._cancelPurchase({
        email: args.userEmail,
        transactionId: purchase.transactionId,
      });
    }

    return true;
  }

  findOne(id: number) {
    return `This action returns a #${id} purchase`;
  }

  private async _cancelPurchase(args: {
    transactionId: string;
    email: string;
  }) {
    const purchase = await this.prisma.userPurchase.findFirst({
      where: { transactionId: args.transactionId },
    });
    if (purchase) {
      const result = await this.prisma.userPurchase.delete({
        where: { transactionId: args.transactionId },
      });
      this.logger.warn(
        `Cancel purchase id ${args.transactionId} email: ${args.email}`,
      );
      this.notificationService.sendPushNotificationToUser({
        userEmail: args.email,
        title: 'Purchase Cancel',
        message: `Your purchase has been canceled`,
      });
      this._notifyUserWithPurchases({ userEmail: args.email });
      return result;
    }
    return 'No transaction found to cancel';
  }

  private async _purchase(args: {
    productId: string;
    appUserId: string;
    transactionId: string;
    email: string;
  }) {
    const product = await this.prisma.storeProduct.findUnique({
      where: { name: args.productId },
    });
    if (!product) {
      throw new BadRequestException(
        `No product registered with id ${args.productId}`,
      );
    }
    const purchase = await this.prisma.userPurchase.findUnique({
      where: { transactionId: args.transactionId, appUserId: args.appUserId },
    });
    if (purchase) {
      throw new BadRequestException(`Purchase already registered`);
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
    this.notificationService.sendPushNotificationToUser({
      userEmail: args.email,
      title: 'Purchase successful',
      message: 'Check your store purchases to claim your items',
    });
    this._notifyUserWithPurchases({ userEmail: args.email });
    return result;
  }

  private async _notifyUserWithPurchases(args: { userEmail: string }) {
    const purchases = await this._getAllUserPurchases(args);
    this.websocket.sendMessageToSocket({
      event: 'purchases',
      email: args.userEmail,
      payload: purchases,
    });
  }

  private async _getAllUserPurchases(args: { userEmail: string }) {
    return this.prisma.userPurchase.findMany({
      where: { userEmail: args.userEmail },
      include: { product: true },
    });
  }
}
