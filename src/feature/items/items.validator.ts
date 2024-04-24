import { BadRequestException } from '@nestjs/common';
import { EQUIPABLE_CATEGORIES } from './entities/categories';
import { FullInventoryItem } from './entities/items';

export const ItemsValidator = {
  isEquippable: (args: { category: string }) => {
    if (!EQUIPABLE_CATEGORIES.includes(args.category)) {
      throw new BadRequestException('This item is not equipable');
    }
  },

  isSameCategory: (args: { categoryItem: string; categoryEquipped: string }) => {
    if (args.categoryItem === args.categoryEquipped) {
      return true;
    }
    return false;
  },

  hasRemainingStock: (args: { stack: number; inventoryItem: FullInventoryItem }) => {
    const listing = args.inventoryItem.marketListing;
    const inventoryStock = args.inventoryItem.stack;
    const remainingStock = inventoryStock - (listing ? listing.stack : 0);
    if (args.stack > remainingStock) {
      throw new BadRequestException(`You only have ${remainingStock}, but trying to post ${args.stack} stacks`);
    }
  },
};
