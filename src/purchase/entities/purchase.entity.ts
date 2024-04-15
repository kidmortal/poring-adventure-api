export class RevenueCatPurchaseWebhook {
  api_version: string;
  event: Event;
}

export interface Event {
  aliases: string[];
  app_id: string;
  app_user_id: string;
  commission_percentage: any;
  country_code: string;
  currency: any;
  entitlement_id: any;
  entitlement_ids: any;
  environment: string;
  event_timestamp_ms: number;
  expiration_at_ms: number;
  id: string;
  is_family_share: any;
  offer_code: any;
  original_app_user_id: string;
  original_transaction_id: any;
  period_type: string;
  presented_offering_id: any;
  price: any;
  price_in_purchased_currency: any;
  product_id: string;
  purchased_at_ms: number;
  store: string;
  subscriber_attributes: SubscriberAttributes;
  takehome_percentage: any;
  tax_percentage: any;
  transaction_id: string;
  type: 'NON_RENEWING_PURCHASE' | 'CANCELLATION' | 'TEST';
}

export interface SubscriberAttributes {
  $displayName: DisplayName;
  $email: Email;
  $phoneNumber: PhoneNumber;
  my_custom_attribute_1?: CustomAttribute;
}

export interface DisplayName {
  updated_at_ms: number;
  value: string;
}

export interface Email {
  updated_at_ms: number;
  value: string;
}

export interface PhoneNumber {
  updated_at_ms: number;
  value: string;
}

export interface CustomAttribute {
  updated_at_ms: number;
  value: string;
}
