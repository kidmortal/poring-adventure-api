import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { TransactionContext } from 'src/core/prisma/types/prisma';
import { UserStatsService } from 'src/feature/users/userStats.service';
import { InventoryService } from './inventory.service';
import { ItemsValidator } from './items.validator';
import { itemStatBlock } from './items.rules';

/**
 * Equipping and unequipping. An equipped item is a separate inventory row with
 * `equipped: true`, and its stat block is added to (or removed from) the user.
 */
@Injectable()
export class EquipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly userStats: UserStatsService,
  ) {}

  /** Equips the item, swapping out whatever occupies the same category. */
  async equipItem(args: { inventoryId: number; userEmail: string }) {
    return this.prisma.$transaction(async (tx) => {
      const inventoryItem = await this.inventory.getOneInventoryItem({ ...args, tx });
      if (!inventoryItem) return false;

      ItemsValidator.isEquippable({ category: inventoryItem.item.category });
      ItemsValidator.hasRemainingStock({ stack: 1, inventoryItem });

      const stats = await tx.stats.findUnique({ where: { userEmail: args.userEmail } });
      ItemsValidator.meetsRequiredLevel({
        requiredLevel: inventoryItem.item.requiredLevel,
        level: stats?.level ?? 1,
        itemName: inventoryItem.item.name,
      });

      const equippedItems = await this.inventory.getAllEquippedItems({ userEmail: args.userEmail, tx });
      const sameCategory = equippedItems.find((equip) =>
        ItemsValidator.isSameCategory({
          categoryItem: inventoryItem.item.category,
          categoryEquipped: equip.item.category,
        }),
      );

      if (sameCategory) {
        await this._unequip({ inventoryId: sameCategory.id, userEmail: args.userEmail, tx });
      }
      return this._equip({ inventoryId: args.inventoryId, userEmail: args.userEmail, tx });
    });
  }

  async unequipItem(args: { inventoryId: number; userEmail: string }) {
    return this.prisma.$transaction((tx) => this._unequip({ ...args, tx }));
  }

  private async _equip(args: { inventoryId: number; userEmail: string; tx?: TransactionContext }) {
    const tx = args.tx || this.prisma;
    const inventoryItem = await this.inventory.getOneInventoryItem({ ...args, tx });
    if (!inventoryItem || inventoryItem.equipped) return false;

    await tx.inventoryItem.create({
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
    await this.inventory.removeItemFromInventory({
      inventoryId: inventoryItem.id,
      userEmail: inventoryItem.userEmail,
      stack: 1,
      tx,
    });
    await this.userStats.increaseUserStats({
      userEmail: inventoryItem.userEmail,
      ...itemStatBlock(inventoryItem),
      tx,
    });
    return true;
  }

  private async _unequip(args: { inventoryId: number; userEmail: string; tx?: TransactionContext }) {
    const tx = args.tx || this.prisma;
    const inventoryItem = await this.inventory.getOneInventoryItem({ ...args, tx });
    if (!inventoryItem) {
      throw new BadRequestException(`no equipped item with inventoryId: ${args.inventoryId}`);
    }
    if (!inventoryItem.equipped) return false;

    await this.inventory.addItemToInventory({
      itemId: inventoryItem.itemId,
      userEmail: inventoryItem.userEmail,
      enhancement: inventoryItem.enhancement,
      quality: inventoryItem.quality,
      locked: inventoryItem.locked,
      stack: 1,
      tx,
    });
    await tx.inventoryItem.delete({ where: { id: inventoryItem.id } });
    await this.userStats.decreaseUserStats({
      userEmail: inventoryItem.userEmail,
      ...itemStatBlock(inventoryItem),
      tx,
    });
    return true;
  }
}
