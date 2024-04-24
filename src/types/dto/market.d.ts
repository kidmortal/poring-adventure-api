declare type CreateMarketListingDto = {
  price: number;
  stack: number;
  inventoryId: number;
};

declare type PuchaseMarketListingDto = {
  marketListingId: number;
  stack: number;
};

declare type RemoveMarketListingDto = {
  marketListingId: number;
};

declare type GetAllMarketListingDto = {
  page: number;
  category: 'all' | 'equipment' | 'consumable' | 'material';
};
