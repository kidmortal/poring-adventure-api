declare type ConsumeItemDto = {
  inventoryId: number;
};

declare type EquipItemDto = {
  inventoryId: number;
};

declare type UnequipItemDto = {
  inventoryId: number;
};

declare type EnhanceItemDto = {
  inventoryId: number;
};

declare type UpgradeItemDto = {
  inventoryId: number;
  /** The duplicate to feed in. Left out, the least enhanced copy is chosen. */
  materialInventoryId?: number;
};
