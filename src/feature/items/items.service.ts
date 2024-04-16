import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateItemDto } from './dto/create-item.dto';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { UsersService } from 'src/feature/users/users.service';
import { Item } from '@prisma/client';
import { TransactionContext } from 'src/core/prisma/types/prisma';
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

  async consumeItem(args: {
    userEmail: string;
    itemId: number;
    stack: number;
  }) {
    await this.prisma.$transaction(async (tx) => {
      const inventoryItem = await this._getOneInventoryItem({ ...args, tx });
      if (inventoryItem) {
        const item = inventoryItem.item;
        if (item.category === 'consumable') {
          if (item.health) {
            await this.userService.incrementUserHealth({
              userEmail: args.userEmail,
              amount: item.health,
              tx,
            });
          }
          if (item.mana) {
            await this.userService.incrementUserMana({
              userEmail: args.userEmail,
              amount: item.mana,
              tx,
            });
          }
          await this._removeItemFromUserInventory({ ...args, tx });
          return true;
        }
      }
    });
    return false;
  }

  async addItemToUser(args: {
    userEmail: string;
    itemId: number;
    stack: number;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;
    const userHasItem = await this._userHasItem(args);

    if (userHasItem) {
      const updateAmount = await tx.inventoryItem.update({
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
      const createNewItem = await tx.inventoryItem.create({
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
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;
    await this._removeItemFromUserInventory({
      itemId: args.itemId,
      stack: args.stack,
      userEmail: args.senderEmail,
      tx,
    });

    return this.addItemToUser({
      itemId: args.itemId,
      stack: args.stack,
      userEmail: args.receiverEmail,
      tx,
    });
  }

  async equipItem(args: { itemId: number; userEmail: string }) {
    await this.prisma.$transaction(async (tx) => {
      const inventoryItem = await this._getOneInventoryItem({ ...args, tx });
      if (!inventoryItem) return false;
      ItemsValidator.isEquippable({ category: inventoryItem.item.category });
      const equippedItems = await this._getAllEquippedItems({ ...args, tx });
      for await (const equip of equippedItems) {
        const isSameAsEquipped = ItemsValidator.isSameCategory({
          categoryItem: inventoryItem.item.category,
          categoryEquipped: equip.item.category,
        });
        if (isSameAsEquipped) {
          await this._swapEquippedItem({
            equipItem: inventoryItem.item,
            unequipItem: equip.item,
            userEmail: args.userEmail,
            tx,
          });
          return true;
        }
      }
      await this._equipItem({
        item: inventoryItem.item,
        userEmail: args.userEmail,
        tx,
      });
      return true;
    });

    return false;
  }

  async unequipItem(args: { itemId: number; userEmail: string }) {
    await this.prisma.$transaction(async (tx) => {
      const equippedItem = await this._getOneEquippedItem({ ...args, tx });
      if (equippedItem) {
        await this._unequipItem({
          item: equippedItem.item,
          userEmail: args.userEmail,
          tx,
        });
      }
      return true;
    });

    return false;
  }

  findAll() {
    return `This action returns all items`;
  }

  private async _removeItemFromUserInventory(args: {
    userEmail: string;
    itemId: number;
    stack: number;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;
    const userHasItem = await this._userHasItem(args);

    if (userHasItem && userHasItem.stack < args.stack) {
      throw new BadRequestException(
        `User only have ${userHasItem.stack} stacks, but you trying to remove ${args.stack}`,
      );
    }

    if (userHasItem.stack === args.stack) {
      const updateAmount = await tx.inventoryItem.delete({
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
      const updateAmount = await tx.inventoryItem.update({
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

  private async _swapEquippedItem(args: {
    unequipItem: Item;
    equipItem: Item;
    userEmail: string;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;
    await this._unequipItem({
      item: args.unequipItem,
      userEmail: args.userEmail,
      tx,
    });
    await this._equipItem({
      item: args.equipItem,
      userEmail: args.userEmail,
      tx,
    });
  }

  private async _addEquipmentToUser(args: {
    itemId: number;
    userEmail: string;
    itemInfo: Item;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;

    await this.userService.increaseUserStats({
      userEmail: args.userEmail,
      health: args.itemInfo.health,
      attack: args.itemInfo.attack,
      mana: args.itemInfo.mana,
      str: args.itemInfo.str,
      agi: args.itemInfo.agi,
      int: args.itemInfo.int,
      tx,
    });

    return tx.equippedItem.create({
      data: {
        userEmail: args.userEmail,
        itemId: args.itemId,
      },
    });
  }
  private async _removeEquipmentFromUser(args: {
    itemId: number;
    userEmail: string;
    itemInfo: Item;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;
    await this.userService.decreaseUserStats({
      userEmail: args.userEmail,
      health: args.itemInfo.health,
      attack: args.itemInfo.attack,
      mana: args.itemInfo.mana,
      str: args.itemInfo.str,
      agi: args.itemInfo.agi,
      int: args.itemInfo.int,
      tx,
    });

    return tx.equippedItem.delete({
      where: {
        userEmail_itemId: {
          userEmail: args.userEmail,
          itemId: args.itemId,
        },
      },
    });
  }

  private async _userHasItem(args: {
    userEmail: string;
    itemId: number;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;

    return tx.inventoryItem.findUnique({
      where: {
        userEmail_itemId: {
          userEmail: args.userEmail,
          itemId: args.itemId,
        },
      },
    });
  }

  private async _getOneInventoryItem(args: {
    userEmail: string;
    itemId: number;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;
    return tx.inventoryItem.findUnique({
      where: {
        userEmail_itemId: {
          userEmail: args.userEmail,
          itemId: args.itemId,
        },
      },
      include: { item: true },
    });
  }

  private async _getOneEquippedItem(args: {
    userEmail: string;
    itemId: number;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;

    return tx.equippedItem.findUnique({
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

  private async _getAllEquippedItems(args: {
    userEmail: string;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;

    return tx.equippedItem.findMany({
      where: { userEmail: args.userEmail },
      include: { item: true },
    });
  }

  private async _unequipItem(args: {
    item: Item;
    userEmail: string;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;
    await this._removeEquipmentFromUser({
      userEmail: args.userEmail,
      itemId: args.item.id,
      itemInfo: args.item,
      tx,
    });
    await this.addItemToUser({
      stack: 1,
      userEmail: args.userEmail,
      itemId: args.item.id,
      tx,
    });
  }

  private async _equipItem(args: {
    item: Item;
    userEmail: string;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;
    await this._addEquipmentToUser({
      userEmail: args.userEmail,
      itemId: args.item.id,
      itemInfo: args.item,
      tx,
    });
    await this._removeItemFromUserInventory({
      stack: 1,
      userEmail: args.userEmail,
      itemId: args.item.id,
      tx,
    });
  }
}
