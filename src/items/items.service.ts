import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateItemDto } from './dto/create-item.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';
import { Item } from '@prisma/client';
import { TransactionCtx } from 'src/prisma/types/prisma';
import { ItemsValidator } from './items.validator';

@Injectable()
export class ItemsService {
  constructor(
    private readonly userService: UsersService,
    private readonly prisma: PrismaService,
  ) {}
  create(createItemDto: CreateItemDto) {
    return this.prisma.item.create({ data: createItemDto });
  }

  async removeItemFromUser(args: {
    userEmail: string;
    itemId: number;
    stack: number;
    ctx?: TransactionCtx;
  }) {
    const ctx = args.ctx || this.prisma;
    const userHasItem = await this.userHasItem(args);

    if (userHasItem && userHasItem.stack < args.stack) {
      throw new BadRequestException(
        `User only have ${userHasItem.stack} stacks, but you trying to remove ${args.stack}`,
      );
    }

    if (userHasItem.stack === args.stack) {
      const updateAmount = await ctx.inventoryItem.delete({
        where: {
          userEmail_itemId: {
            userEmail: args.userEmail,
            itemId: args.itemId,
          },
        },
      });
      return updateAmount;
    }

    if (userHasItem.stack > args.stack) {
      const updateAmount = await ctx.inventoryItem.update({
        where: {
          userEmail_itemId: {
            userEmail: args.userEmail,
            itemId: args.itemId,
          },
        },
        data: {
          stack: {
            decrement: args.stack,
          },
        },
      });
      return updateAmount;
    }

    throw new BadRequestException(
      `There was an error processing this`,
      `args: ${JSON.stringify(args)}`,
    );
  }

  async consumeItem(args: {
    userEmail: string;
    itemId: number;
    stack: number;
    ctx?: TransactionCtx;
  }) {
    const ctx = args.ctx || this.prisma;
    const inventoryItem = await this.getInventoryItem(args);
    if (inventoryItem) {
      const item = inventoryItem.item;
      if (item.category === 'consumable') {
        if (item.health) {
          await this.userService.incrementUserHealth({
            userEmail: args.userEmail,
            amount: item.health,
            ctx,
          });
        }
        if (item.mana) {
          await this.userService.incrementUserMana({
            userEmail: args.userEmail,
            amount: item.mana,
            ctx,
          });
        }
        await this.removeItemFromUser(args);
        return true;
      }
    }
  }

  async addItemToUser(args: {
    userEmail: string;
    itemId: number;
    stack: number;
    ctx?: TransactionCtx;
  }) {
    const ctx = args.ctx || this.prisma;
    const userHasItem = await this.userHasItem(args);

    if (userHasItem) {
      const updateAmount = await ctx.inventoryItem.update({
        where: {
          userEmail_itemId: {
            userEmail: args.userEmail,
            itemId: args.itemId,
          },
        },
        data: {
          stack: {
            increment: args.stack,
          },
        },
      });
      return updateAmount;
    }

    try {
      const createNewItem = await ctx.inventoryItem.create({
        data: {
          userEmail: args.userEmail,
          itemId: args.itemId,
          stack: args.stack,
        },
      });
      return createNewItem;
    } catch (error) {
      throw new BadRequestException(
        'Either the user or the item does not exist',
      );
    }
  }

  async transferItemFromUserToUser(args: {
    senderEmail: string;
    receiverEmail: string;
    itemId: number;
    stack: number;
    ctx?: TransactionCtx;
  }) {
    const ctx = args.ctx || this.prisma;
    await this.removeItemFromUser({
      itemId: args.itemId,
      stack: args.stack,
      userEmail: args.senderEmail,
      ctx,
    });

    return this.addItemToUser({
      itemId: args.itemId,
      stack: args.stack,
      userEmail: args.receiverEmail,
      ctx,
    });
  }

  async equipItem(args: { itemId: number; userEmail: string }) {
    await this.prisma.$transaction(async (ctx) => {
      const inventoryItem = await this.getInventoryItem({ ...args, ctx });
      if (!inventoryItem) return false;
      ItemsValidator.isEquippable({ category: inventoryItem.item.category });
      const equippedItems = await this.getEquippedItems({ ...args, ctx });
      equippedItems.forEach((equip) => {
        ItemsValidator.isSameCategory({
          categoryItem: inventoryItem.item.category,
          categoryEquipped: equip.item.category,
        });
      });
      await this.removeItemFromUser({ ...args, stack: 1, ctx });
      await this.addEquipmentToUser({
        ...args,
        itemInfo: inventoryItem.item,
        ctx,
      });
      return true;
    });

    return false;
  }

  async unequipItem(args: { itemId: number; userEmail: string }) {
    await this.prisma.$transaction(async (ctx) => {
      const equippedItem = await this.getEquippedItem({ ...args, ctx });
      if (equippedItem) {
        await this.addItemToUser({ ...args, stack: 1, ctx });
        await this.removeEquipmentFromUser({
          ...args,
          itemInfo: equippedItem.item,
          ctx,
        });
      }
      return true;
    });

    return false;
  }

  async addEquipmentToUser(args: {
    itemId: number;
    userEmail: string;
    itemInfo: Item;
    ctx?: TransactionCtx;
  }) {
    const ctx = args.ctx || this.prisma;

    await this.userService.increaseUserStats({
      userEmail: args.userEmail,
      health: args.itemInfo.health,
      attack: args.itemInfo.attack,
      mana: args.itemInfo.mana,
      str: args.itemInfo.str,
      agi: args.itemInfo.agi,
      int: args.itemInfo.int,
      ctx,
    });

    return ctx.equippedItem.create({
      data: {
        userEmail: args.userEmail,
        itemId: args.itemId,
      },
    });
  }
  async removeEquipmentFromUser(args: {
    itemId: number;
    userEmail: string;
    itemInfo: Item;
    ctx?: TransactionCtx;
  }) {
    const ctx = args.ctx || this.prisma;
    await this.userService.decreaseUserStats({
      userEmail: args.userEmail,
      health: args.itemInfo.health,
      attack: args.itemInfo.attack,
      mana: args.itemInfo.mana,
      str: args.itemInfo.str,
      agi: args.itemInfo.agi,
      int: args.itemInfo.int,
      ctx,
    });

    return ctx.equippedItem.delete({
      where: {
        userEmail_itemId: {
          userEmail: args.userEmail,
          itemId: args.itemId,
        },
      },
    });
  }

  findAll() {
    return `This action returns all items`;
  }

  async userHasItem(args: {
    userEmail: string;
    itemId: number;
    ctx?: TransactionCtx;
  }) {
    const ctx = args.ctx || this.prisma;

    const userHasItem = await ctx.inventoryItem.findUnique({
      where: {
        userEmail_itemId: {
          userEmail: args.userEmail,
          itemId: args.itemId,
        },
      },
    });

    if (!userHasItem) {
      false;
    }
    return userHasItem;
  }

  async getInventoryItem(args: {
    userEmail: string;
    itemId: number;
    ctx?: TransactionCtx;
  }) {
    const ctx = args.ctx || this.prisma;
    return ctx.inventoryItem.findUnique({
      where: {
        userEmail_itemId: {
          userEmail: args.userEmail,
          itemId: args.itemId,
        },
      },
      include: { item: true },
    });
  }

  async getEquippedItem(args: {
    userEmail: string;
    itemId: number;
    ctx?: TransactionCtx;
  }) {
    const ctx = args.ctx || this.prisma;

    return ctx.equippedItem.findUnique({
      where: {
        userEmail_itemId: {
          userEmail: args.userEmail,
          itemId: args.itemId,
        },
      },
      include: {
        item: true,
      },
    });
  }

  async getEquippedItems(args: { userEmail: string; ctx?: TransactionCtx }) {
    const ctx = args.ctx || this.prisma;

    return ctx.equippedItem.findMany({
      where: { userEmail: args.userEmail },
      include: { item: true },
    });
  }
}
