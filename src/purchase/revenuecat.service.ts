import axios from 'axios';

import * as Sentry from '@sentry/node';
import { RevenueCatCustomer } from './entities/customer.entity';
export class RevenueCatService {
  constructor() {}

  private client = axios.create({
    baseURL: 'https://api.revenuecat.com/v1/',
    headers: {
      Authorization: `Bearer ${process.env.REVENUE_CAT_REST_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  async refundPurchase(args: { transactionId: string; appUserId: string }) {
    try {
      await this.client.post(
        `/subscribers/${args.appUserId}/transactions/${args.transactionId}/refund`,
        {},
      );
      return true;
    } catch (error) {
      console.log(error.response);
      Sentry.captureException(error);
      return false;
    }
  }

  async userHasTransaction(args: { transactionId: string; appUserId: string }) {
    let hasTransaction = false;
    try {
      const customer = await this.client.get<RevenueCatCustomer>(
        `/subscribers/${args.appUserId}`,
        {},
      );
      const transactionsGroups = Object.values(
        customer.data.subscriber.non_subscriptions,
      );
      transactionsGroups.forEach((transactionGroup) => {
        const userTransaction = transactionGroup.find(
          (transaction) =>
            transaction.store_transaction_id === args.transactionId,
        );
        if (userTransaction) {
          hasTransaction = true;
        }
      });
      return hasTransaction;
    } catch (error) {
      console.log(error.response);
      Sentry.captureException(error);
      return hasTransaction;
    }
  }
}
