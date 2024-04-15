import axios from 'axios';

export class RevenueCatService {
  private client = axios.create({
    baseURL: 'https://api.revenuecat.com/v1/',
    headers: {
      Authorization: `Bearer ${process.env.REVENUE_CAT_REST_API_KEY}`,
    },
  });
  constructor() {}
  async refundPurchase(args: { transactionId: string; appUserId: string }) {
    const result = await this.client.post(
      `https://api.revenuecat.com/v1/subscribers/${args.appUserId}/transactions/${args.transactionId}/refund`,
    );
    return result;
  }
}
