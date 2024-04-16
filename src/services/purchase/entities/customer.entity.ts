export type RevenueCatCustomer = {
  request_date: string;
  request_date_ms: number;
  subscriber: Subscriber;
};

export type Subscriber = {
  first_seen: string;
  last_seen: string;
  management_url: any;
  non_subscriptions: NonSubscriptions;
  original_app_user_id: string;
  original_application_version: any;
  original_purchase_date: any;
  other_purchases: OtherPurchases;
  subscriber_attributes: SubscriberAttributes;
};

export type NonSubscriptions = {
  [key: string]: Purchase[];
};

export type Purchase = {
  id: string;
  is_sandbox: boolean;
  original_purchase_date: string;
  purchase_date: string;
  store: string;
  store_transaction_id: string;
};

export type OtherPurchases = {
  gift: Gift2;
};

export type Gift2 = {
  purchase_date: string;
};

export type SubscriberAttributes = {
  $email: Email;
};

export type Email = {
  updated_at_ms: number;
  value: string;
};
