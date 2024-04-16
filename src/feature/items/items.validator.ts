import { BadRequestException } from '@nestjs/common';
import { EQUIPABLE_CATEGORIES } from './entities/categories';

export const ItemsValidator = {
  isEquippable: (args: { category: string }) => {
    if (!EQUIPABLE_CATEGORIES.includes(args.category)) {
      throw new BadRequestException('This item is not equipable');
    }
  },

  isSameCategory: (args: {
    categoryItem: string;
    categoryEquipped: string;
  }) => {
    if (args.categoryItem === args.categoryEquipped) {
      return true;
    }
    return false;
  },
};
