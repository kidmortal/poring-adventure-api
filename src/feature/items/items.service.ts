import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from 'src/core/prisma/prisma.service';
import { UsersService } from 'src/feature/users/users.service';
import { TransactionContext } from 'src/core/prisma/types/prisma';
import { ItemsValidator } from './items.validator';
import { Utils } from 'src/utilities/utils';
import { WebsocketService } from 'src/core/websocket/websocket.service';

@Injectable()
export class ItemsService {
  constructor(
    private readonly userService: UsersService,
    private readonly prisma: PrismaService,
    private readonly websocket: WebsocketService,
  ) {}

  async enhanceItem(args: { userEmail: string; inventoryId: number }) {
    return this.prisma.$transaction(async (tx) => {
      const inventoryItem = await this.getOneInventoryItem({
        userEmail: args.userEmail,
        inventoryId: args.inventoryId,
        tx,
      });
      if (inventoryItem) {
        if (inventoryItem.equipped) {
          this.websocket.sendErrorNotification({
            email: args.userEmail,
            text: `Cannot enhance equipped item`,
          });
          return false;
        }

        const user = await this.userService._getUserWithEmail({ userEmail: args.userEmail });
        if (!user) {
          this.websocket.sendErrorNotification({
            email: args.userEmail,
            text: `User does not exist`,
          });
          return false;
        }

        const chance = Utils.enhanceChance(inventoryItem.enhancement + 1);
        const price = Utils.enhancePrice(inventoryItem.enhancement + 1);
        if (user.silver < price) {
          this.websocket.sendErrorNotification({
            email: args.userEmail,
            text: `Not enough silver`,
          });
          return false;
        }
        const success = Utils.isSuccess(chance);
        if (success) {
          await this.removeItemFromInventory({ ...args, stack: 1, tx });
          await this.addItemToInventory({
            itemId: inventoryItem.itemId,
            quality: inventoryItem.quality,
            enhancement: inventoryItem.enhancement + 1,
            stack: 1,
            userEmail: args.userEmail,
            tx,
          });
          this.websocket.sendTextNotification({
            email: args.userEmail,
            text: `You have successfully enhanced your item`,
          });
        } else {
          this.websocket.sendErrorNotification({
            email: args.userEmail,
            text: `You have failed to enhance your item`,
          });
        }
        await this.userService.removeSilverFromUser({ userEmail: args.userEmail, amount: price, tx });
        this.userService.notifyUserUpdateWithProfile({ email: args.userEmail });
        return true;
      }
    });
  }

  async upgradeItem(args: { userEmail: string; inventoryId: number }) {}

  async consumeItem(args: { userEmail: string; inventoryId: number; stack: number }) {
    await this.prisma.$transaction(async (tx) => {
      const inventoryItem = await this.getOneInventoryItem({
        userEmail: args.userEmail,
        inventoryId: args.inventoryId,
        tx,
      });
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
          await this.removeItemFromInventory({ ...args, tx });
          return true;
        }
      }
    });
    return false;
  }

  async addItemToInventory(args: {
    userEmail: string;
    itemId: number;
    quality?: number;
    enhancement?: number;
    locked?: boolean;
    equipped?: boolean;
    stack: number;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;

    const userHasItem = await this._userHasItem({
      userEmail: args.userEmail,
      itemId: args.itemId,
      quality: args.quality ?? 1,
      enhancement: args.enhancement ?? 0,
      equipped: args.equipped ?? false,
      locked: args.locked ?? false,
      tx,
    });

    if (userHasItem) {
      const updateAmount = await tx.inventoryItem.update({
        where: {
          userEmail_itemId_quality_enhancement_equipped_locked: {
            userEmail: userHasItem.userEmail,
            itemId: userHasItem.itemId,
            enhancement: userHasItem.enhancement,
            quality: userHasItem.quality,
            equipped: userHasItem.equipped,
            locked: userHasItem.locked,
          },
        },
        data: { stack: { increment: args.stack } },
      });
      return updateAmount;
    }

    try {
      const createNewItem = await tx.inventoryItem.create({
        data: {
          userEmail: args.userEmail,
          itemId: args.itemId,
          locked: args.locked ?? false,
          quality: args.quality ?? 1,
          enhancement: args.enhancement ?? 0,
          equipped: args.equipped,
          stack: args.stack,
        },
      });
      return createNewItem;
    } catch (error) {
      throw new BadRequestException('Either the user or the item does not exist');
    }
  }

  async transferItemFromUserToUser(args: {
    senderEmail: string;
    receiverEmail: string;
    inventoryId: number;
    stack: number;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;
    const removedItem = await this.removeItemFromInventory({
      inventoryId: args.inventoryId,
      stack: args.stack,
      userEmail: args.senderEmail,
      tx,
    });

    return this.addItemToInventory({
      itemId: removedItem.itemId,
      quality: removedItem.quality,
      enhancement: removedItem.enhancement,
      locked: removedItem.locked,
      stack: args.stack,
      userEmail: args.receiverEmail,
      tx,
    });
  }

  async equipItem(args: { inventoryId: number; userEmail: string }) {
    await this.prisma.$transaction(async (tx) => {
      const inventoryItem = await this.getOneInventoryItem({
        inventoryId: args.inventoryId,
        userEmail: args.userEmail,
        tx,
      });
      if (!inventoryItem) return false;
      ItemsValidator.isEquippable({ category: inventoryItem.item.category });
      ItemsValidator.hasRemainingStock({ stack: 1, inventoryItem });
      const equippedItems = await this._getAllEquippedItems({ ...args, tx });

      for await (const equip of equippedItems) {
        const isSameAsEquipped = ItemsValidator.isSameCategory({
          categoryItem: inventoryItem.item.category,
          categoryEquipped: equip.item.category,
        });
        if (isSameAsEquipped) {
          await this._swapEquippedItem({
            equipInventoryId: inventoryItem.id,
            unequipInventoryId: equip.id,
            userEmail: args.userEmail,
            tx,
          });
          return true;
        }
      }

      await this._equipItem({
        inventoryId: args.inventoryId,
        userEmail: args.userEmail,
        tx,
      });
      return true;
    });

    return false;
  }

  async unequipItem(args: { inventoryId: number; userEmail: string }) {
    await this.prisma.$transaction(async (tx) => {
      await this._unequipItem({
        inventoryId: args.inventoryId,
        userEmail: args.userEmail,
        tx,
      });
      return true;
    });

    return false;
  }

  findAll() {
    return `This action returns all items`;
  }

  private async removeItemFromInventory(args: {
    userEmail: string;
    inventoryId: number;
    stack: number;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;
    const userHasItem = await this.getOneInventoryItem({
      userEmail: args.userEmail,
      inventoryId: args.inventoryId,
      tx,
    });

    if (userHasItem && userHasItem.stack < args.stack) {
      throw new BadRequestException(
        `User only have ${userHasItem.stack} stacks, but you trying to remove ${args.stack}`,
      );
    }

    if (userHasItem.stack === args.stack) {
      const removedItem = await tx.inventoryItem.delete({
        where: { id: args.inventoryId },
      });
      return removedItem;
    }

    if (userHasItem.stack > args.stack) {
      const updateAmount = await tx.inventoryItem.update({
        where: { id: args.inventoryId },
        data: { stack: { decrement: args.stack } },
      });
      return updateAmount;
    }

    throw new BadRequestException(`There was an error processing this`, `args: ${JSON.stringify(args)}`);
  }

  private async _swapEquippedItem(args: {
    unequipInventoryId: number;
    equipInventoryId: number;
    userEmail: string;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;
    await this._unequipItem({
      inventoryId: args.unequipInventoryId,
      userEmail: args.userEmail,
      tx,
    });
    await this._equipItem({
      inventoryId: args.equipInventoryId,
      userEmail: args.userEmail,
      tx,
    });
  }

  private async _userHasItem(args: {
    userEmail: string;
    itemId: number;
    quality: number;
    enhancement: number;
    equipped: boolean;
    locked: boolean;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;

    return tx.inventoryItem.findUnique({
      where: {
        userEmail_itemId_quality_enhancement_equipped_locked: {
          userEmail: args.userEmail,
          itemId: args.itemId,
          quality: args.quality,
          enhancement: args.enhancement,
          equipped: args.equipped,
          locked: args.locked,
        },
      },
    });
  }

  async getOneInventoryItem(args: { userEmail: string; inventoryId: number; tx?: TransactionContext }) {
    const tx = args.tx || this.prisma;
    return tx.inventoryItem.findUnique({
      where: {
        id: args.inventoryId,
        userEmail: args.userEmail,
      },
      include: { item: true, marketListing: true },
    });
  }

  private async _getAllEquippedItems(args: { userEmail: string; tx?: TransactionContext }) {
    const tx = args.tx || this.prisma;

    return tx.inventoryItem.findMany({
      where: { userEmail: args.userEmail, equipped: true },
      include: { item: true },
    });
  }

  private async _unequipItem(args: { inventoryId: number; userEmail: string; tx?: TransactionContext }) {
    const tx = args.tx || this.prisma;
    const inventoryItem = await this.getOneInventoryItem({
      inventoryId: args.inventoryId,
      userEmail: args.userEmail,
      tx,
    });
    if (inventoryItem.equipped) {
      await this.addItemToInventory({
        itemId: inventoryItem.itemId,
        userEmail: inventoryItem.userEmail,
        enhancement: inventoryItem.enhancement,
        quality: inventoryItem.quality,
        locked: inventoryItem.locked,
        stack: 1,
        tx,
      });
      await this._removeEquippedItem({
        inventoryId: inventoryItem.id,
        userEmail: inventoryItem.userEmail,
        tx,
      });
      const enhancement = inventoryItem?.enhancement ?? 0;
      const quality = inventoryItem?.quality ?? 0;
      const multiplier = Utils.itemStatsMultiplier(quality, enhancement);
      await this.userService.decreaseUserStats({
        userEmail: inventoryItem.userEmail,
        health: Math.floor(inventoryItem.item.health * multiplier),
        mana: Math.floor(inventoryItem.item.mana * multiplier),
        attack: Math.floor(inventoryItem.item.attack * multiplier),
        str: Math.floor(inventoryItem.item.str * multiplier),
        agi: Math.floor(inventoryItem.item.agi * multiplier),
        int: Math.floor(inventoryItem.item.int * multiplier),
        tx,
      });

      return true;
    }
    return false;
  }

  private async _equipItem(args: { inventoryId: number; userEmail: string; tx?: TransactionContext }) {
    const tx = args.tx || this.prisma;
    const inventoryItem = await this.getOneInventoryItem({
      inventoryId: args.inventoryId,
      userEmail: args.userEmail,
      tx,
    });
    if (inventoryItem && inventoryItem.equipped === false) {
      await this._createEquippedItem({ inventoryId: inventoryItem.id, userEmail: inventoryItem.userEmail, tx });
      await this.removeItemFromInventory({
        inventoryId: inventoryItem.id,
        userEmail: inventoryItem.userEmail,
        stack: 1,
        tx,
      });
      const enhancement = inventoryItem?.enhancement ?? 0;
      const quality = inventoryItem?.quality ?? 0;
      const multiplier = Utils.itemStatsMultiplier(quality, enhancement);
      await this.userService.increaseUserStats({
        userEmail: inventoryItem.userEmail,
        health: Math.floor(inventoryItem.item.health * multiplier),
        mana: Math.floor(inventoryItem.item.mana * multiplier),
        attack: Math.floor(inventoryItem.item.attack * multiplier),
        str: Math.floor(inventoryItem.item.str * multiplier),
        agi: Math.floor(inventoryItem.item.agi * multiplier),
        int: Math.floor(inventoryItem.item.int * multiplier),
        tx,
      });

      return true;
    }
    return false;
  }

  private async _removeEquippedItem(args: { inventoryId: number; userEmail: string; tx?: TransactionContext }) {
    const tx = args.tx || this.prisma;
    const inventoryItem = await this.getOneInventoryItem({
      inventoryId: args.inventoryId,
      userEmail: args.userEmail,
      tx,
    });
    if (inventoryItem && inventoryItem.equipped === true) {
      return tx.inventoryItem.delete({
        where: { id: inventoryItem.id },
      });
    }
    throw new BadRequestException(`no equipped item with inventoryId: ${args.inventoryId}`);
  }

  private async _createEquippedItem(args: { userEmail: string; inventoryId: number; tx?: TransactionContext }) {
    const tx = args.tx || this.prisma;
    const inventoryItem = await this.getOneInventoryItem({
      inventoryId: args.inventoryId,
      userEmail: args.userEmail,
      tx,
    });
    if (inventoryItem) {
      return tx.inventoryItem.create({
        data: {
          userEmail: inventoryItem.userEmail,
          itemId: inventoryItem.itemId,
          quality: inventoryItem.quality,
          enhancement: inventoryItem.enhancement,
          locked: inventoryItem.locked,
          equipped: true,
          stack: 1,
        },
      });
    }
    throw new BadRequestException(`no inventory item with inventoryId: ${args.inventoryId}`);
  }
}
