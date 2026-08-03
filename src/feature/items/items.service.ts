import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { TRANSACTION_OPTIONS } from 'src/core/prisma/types/prisma';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { UsersService } from 'src/feature/users/users.service';
import { UserStatsService } from 'src/feature/users/userStats.service';
import { UserWalletService } from 'src/feature/users/userWallet.service';
import { Utils } from 'src/utilities/utils';
import { InventoryService } from './inventory.service';

/**
 * What a player can do *to* an item: enhance it, or consume it.
 * Storage lives in InventoryService, equipping in EquipmentService.
 */
@Injectable()
export class ItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly userService: UsersService,
    private readonly userStats: UserStatsService,
    private readonly userWallet: UserWalletService,
    private readonly websocket: WebsocketService,
  ) {}

  /**
   * Pays the enhancement price and rolls for success. The silver is spent
   * either way — a failed roll simply leaves the item untouched. Returns the
   * outcome so the caller can show it, or false when the attempt was refused.
   *
   * Checking and notifying stay outside the transaction. Both of those read the
   * full profile, which is the heaviest query in the app, and holding a
   * transaction open across two of them against a remote database is what used
   * to blow the interactive budget.
   */
  async enhanceItem(args: { userEmail: string; inventoryId: number }) {
    const inventoryItem = await this.inventory.getOneInventoryItem(args);
    if (!inventoryItem) return false;

    if (inventoryItem.equipped) {
      return this._deny(args.userEmail, 'Cannot enhance equipped item');
    }

    // Only the silver is in question, so this reads the one column instead of
    // the profile with its inventory, skills, buffs and guild attached.
    const wallet = await this.prisma.user.findUnique({
      where: { email: args.userEmail },
      select: { silver: true },
    });
    if (!wallet) {
      return this._deny(args.userEmail, 'User does not exist');
    }

    const nextEnhancement = inventoryItem.enhancement + 1;
    const price = Utils.enhancePrice(nextEnhancement);
    if (wallet.silver < price) {
      return this._deny(args.userEmail, 'Not enough silver');
    }

    const chance = Utils.enhanceChance(nextEnhancement);
    const success = Utils.isSuccess(chance);

    // What has to be atomic, and nothing else: paying for the attempt and
    // applying what it rolled.
    await this.prisma.$transaction(async (tx) => {
      if (success) {
        await this.inventory.removeItemFromInventory({ ...args, stack: 1, tx });
        await this.inventory.addItemToInventory({
          itemId: inventoryItem.itemId,
          quality: inventoryItem.quality,
          enhancement: nextEnhancement,
          stack: 1,
          userEmail: args.userEmail,
          tx,
        });
      }

      await this.userWallet.removeSilverFromUser({ userEmail: args.userEmail, amount: price, tx });
    }, TRANSACTION_OPTIONS);

    // After the commit, so what goes out is the profile that was actually
    // written — pushing from inside sent the client the pre-spend silver.
    await this.userService.notifyUserUpdateWithProfile({ email: args.userEmail });

    return {
      item: inventoryItem.item.name,
      enhancement: success ? nextEnhancement : inventoryItem.enhancement,
      success,
      chance,
      forgePrice: price,
    };
  }

  /** Not implemented yet — item upgrading is still to be designed. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async upgradeItem(args: { userEmail: string; inventoryId: number }) {}

  /** Consumables restore health and mana, then leave the inventory. */
  async consumeItem(args: { userEmail: string; inventoryId: number; stack: number }) {
    return this.prisma.$transaction(async (tx) => {
      const inventoryItem = await this.inventory.getOneInventoryItem({ ...args, tx });
      if (inventoryItem?.item.category !== 'consumable') return false;

      const { item } = inventoryItem;
      if (item.health) {
        await this.userStats.incrementUserHealth({ userEmail: args.userEmail, amount: item.health, tx });
      }
      if (item.mana) {
        await this.userStats.incrementUserMana({ userEmail: args.userEmail, amount: item.mana, tx });
      }
      await this.inventory.removeItemFromInventory({ ...args, tx });
      return true;
    }, TRANSACTION_OPTIONS);
  }

  private _deny(email: string, text: string) {
    this.websocket.sendErrorNotification({ email, text });
    return false;
  }
}
