export const ITEM_CATEGORIES = [
  'all',
  'equipment',
  'consumable',
  'material',
] as const;

export type ItemCategory = (typeof ITEM_CATEGORIES)[number];
