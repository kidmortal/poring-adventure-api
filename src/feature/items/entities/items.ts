import { Prisma } from '@prisma/client';

export type InventoryItemWithItem = Prisma.InventoryItemGetPayload<{
  include: { item: true };
}>;

export type EquippedItemWithItem = Prisma.EquippedItemGetPayload<{
  include: { item: true };
}>;
