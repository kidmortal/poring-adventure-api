import { BadRequestException } from '@nestjs/common';
import { EQUIPABLE_CATEGORIES } from './entities/categories';
import { FullInventoryItem } from './entities/items';

export const ItemsValidator = {
  isEquippable: (args: { category: string }) => {
    if (!EQUIPABLE_CATEGORIES.includes(args.category)) {
      throw new BadRequestException('This item is not equipable');
    }
  },

  /**
   * Only gear carries a stat block, so only gear has anything to enhance. This
   * used to go unchecked, which let a player pay the forge price to put a +3 on
   * a healing potion and get nothing at all for it.
   */
  isEnhanceable: (args: { category: string }) => {
    if (!EQUIPABLE_CATEGORIES.includes(args.category)) {
      throw new BadRequestException('Only equipment can be enhanced');
    }
  },

  /** Gear is tiered, so wearing it is gated on the character's own level. */
  meetsRequiredLevel: (args: { requiredLevel: number; level: number; itemName: string }) => {
    if (args.level < args.requiredLevel) {
      throw new BadRequestException(`${args.itemName} requires level ${args.requiredLevel}`);
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
