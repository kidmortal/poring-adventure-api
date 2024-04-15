import axios from 'axios';

import * as Sentry from '@sentry/node';
export class RevenueCatService {
  private client = axios.create({
    baseURL: 'https://api.revenuecat.com/v1/',
    headers: {
      Authorization: `Bearer ${process.env.REVENUE_CAT_REST_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  constructor() {}
  async refundPurchase(args: { transactionId: string; appUserId: string }) {
    try {
      await this.client.post(
        `https://api.revenuecat.com/v1/subscribers/${args.appUserId}/transactions/${args.transactionId}/refund`,
        {},
      );
      return true;
    } catch (error) {
      Sentry.captureException(error);
      return false;
    }
  }
}
