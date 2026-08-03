import { Prisma } from '@prisma/client';

export type FullInventoryItem = Prisma.InventoryItemGetPayload<{
  include: { item: { include: { buff: true } }; marketListing: true };
}>;
