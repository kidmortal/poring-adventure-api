import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { TransactionContext } from 'src/core/prisma/types/prisma';

/** Identity of an inventory stack — items only merge when all of these match. */
type StackIdentity = {
  userEmail: string;
  itemId: number;
  quality: number;
  enhancement: number;
  equipped: boolean;
  locked: boolean;
};

/** Owning, stacking and moving inventory items. No game rules, just storage. */
@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  getOneInventoryItem(args: { userEmail: string; inventoryId: number; tx?: TransactionContext }) {
    const tx = args.tx || this.prisma;
    return tx.inventoryItem.findUnique({
      where: { id: args.inventoryId, userEmail: args.userEmail },
      // The buff rides along because a consumable's whole effect can live on it,
      // and every caller that consumes one would otherwise re-read the item.
      include: { item: { include: { buff: true } }, marketListing: true },
    });
  }

  getAllEquippedItems(args: { userEmail: string; tx?: TransactionContext }) {
    const tx = args.tx || this.prisma;
    return tx.inventoryItem.findMany({
      where: { userEmail: args.userEmail, equipped: true },
      include: { item: true },
    });
  }

  /** Merges into an identical stack when one exists, otherwise creates a new row. */
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
    const identity = this._identity(args);
    const existing = await this._findStack({ identity, tx });

    if (existing) {
      return tx.inventoryItem.update({
        where: { userEmail_itemId_quality_enhancement_equipped_locked: identity },
        data: { stack: { increment: args.stack } },
      });
    }

    try {
      return await tx.inventoryItem.create({
        data: { ...identity, stack: args.stack },
      });
    } catch (error) {
      throw new BadRequestException('Either the user or the item does not exist');
    }
  }

  /** Removes stacks, deleting the row once it is emptied. */
  async removeItemFromInventory(args: {
    userEmail: string;
    inventoryId: number;
    stack: number;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;
    const owned = await this.getOneInventoryItem({
      userEmail: args.userEmail,
      inventoryId: args.inventoryId,
      tx,
    });

    if (!owned) {
      throw new BadRequestException(`No inventory item found with id ${args.inventoryId}`);
    }
    if (owned.stack < args.stack) {
      throw new BadRequestException(`User only have ${owned.stack} stacks, but you trying to remove ${args.stack}`);
    }

    if (owned.stack === args.stack) {
      return tx.inventoryItem.delete({ where: { id: args.inventoryId } });
    }
    return tx.inventoryItem.update({
      where: { id: args.inventoryId },
      data: { stack: { decrement: args.stack } },
    });
  }

  async transferItemFromUserToUser(args: {
    senderEmail: string;
    receiverEmail: string;
    inventoryId: number;
    stack: number;
    tx?: TransactionContext;
  }) {
    const removedItem = await this.removeItemFromInventory({
      inventoryId: args.inventoryId,
      stack: args.stack,
      userEmail: args.senderEmail,
      tx: args.tx,
    });

    return this.addItemToInventory({
      itemId: removedItem.itemId,
      quality: removedItem.quality,
      enhancement: removedItem.enhancement,
      locked: removedItem.locked,
      stack: args.stack,
      userEmail: args.receiverEmail,
      tx: args.tx,
    });
  }

  private _findStack(args: { identity: StackIdentity; tx: TransactionContext | PrismaService }) {
    return args.tx.inventoryItem.findUnique({
      where: { userEmail_itemId_quality_enhancement_equipped_locked: args.identity },
    });
  }

  private _identity(args: {
    userEmail: string;
    itemId: number;
    quality?: number;
    enhancement?: number;
    equipped?: boolean;
    locked?: boolean;
  }): StackIdentity {
    return {
      userEmail: args.userEmail,
      itemId: args.itemId,
      quality: args.quality ?? 1,
      enhancement: args.enhancement ?? 0,
      equipped: args.equipped ?? false,
      locked: args.locked ?? false,
    };
  }
}
