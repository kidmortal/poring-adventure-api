import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

import * as Sentry from '@sentry/node';
import { RevenueCatCustomer } from './customer.entity';

@Injectable()
export class RevenueCatService {
  private readonly logger = new Logger('RevenueCat');

  private readonly client = axios.create({
    baseURL: 'https://api.revenuecat.com/v1/',
    headers: {
      Authorization: `Bearer ${process.env.REVENUE_CAT_REST_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  async refundPurchase(args: { transactionId: string; appUserId: string }) {
    try {
      await this.client.post(`/subscribers/${args.appUserId}/transactions/${args.transactionId}/refund`, {});
      return true;
    } catch (error) {
      this._reportError(error, `Failed to refund transaction ${args.transactionId}`);
      return false;
    }
  }

  /** Confirms with the store that `appUserId` really owns `transactionId`. */
  async userHasTransaction(args: { transactionId: string; appUserId: string }) {
    try {
      const customer = await this.client.get<RevenueCatCustomer>(`/subscribers/${args.appUserId}`);
      const transactionGroups = Object.values(customer.data.subscriber.non_subscriptions ?? {});
      return transactionGroups.some((group) =>
        group.some((transaction) => transaction.store_transaction_id === args.transactionId),
      );
    } catch (error) {
      this._reportError(error, `Failed to load transactions of ${args.appUserId}`);
      return false;
    }
  }

  private _reportError(error: unknown, context: string) {
    Sentry.captureException(error);
    const details = axios.isAxiosError(error) ? error.response?.data ?? error.message : error;
    this.logger.warn(`${context}: ${JSON.stringify(details)}`);
  }
}
