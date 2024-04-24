import { Prisma } from '@prisma/client';

export type FullInventoryItem = Prisma.InventoryItemGetPayload<{
  include: { item: true; marketListing: true };
}>;
