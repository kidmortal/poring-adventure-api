import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { UsersRepository } from 'src/feature/users/users.repository';
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
    private readonly usersRepository: UsersRepository,
    private readonly userService: UsersService,
    private readonly userStats: UserStatsService,
    private readonly userWallet: UserWalletService,
    private readonly websocket: WebsocketService,
  ) {}

  /**
   * Pays the enhancement price and rolls for success. The silver is spent
   * either way — a failed roll simply leaves the item untouched.
   */
  async enhanceItem(args: { userEmail: string; inventoryId: number }) {
    return this.prisma.$transaction(async (tx) => {
      const inventoryItem = await this.inventory.getOneInventoryItem({ ...args, tx });
      if (!inventoryItem) return false;

      if (inventoryItem.equipped) {
        return this._deny(args.userEmail, 'Cannot enhance equipped item');
      }

      const user = await this.usersRepository.getFullUser({ userEmail: args.userEmail });
      if (!user) {
        return this._deny(args.userEmail, 'User does not exist');
      }

      const nextEnhancement = inventoryItem.enhancement + 1;
      const price = Utils.enhancePrice(nextEnhancement);
      if (user.silver < price) {
        return this._deny(args.userEmail, 'Not enough silver');
      }

      if (Utils.isSuccess(Utils.enhanceChance(nextEnhancement))) {
        await this.inventory.removeItemFromInventory({ ...args, stack: 1, tx });
        await this.inventory.addItemToInventory({
          itemId: inventoryItem.itemId,
          quality: inventoryItem.quality,
          enhancement: nextEnhancement,
          stack: 1,
          userEmail: args.userEmail,
          tx,
        });
        this.websocket.sendTextNotification({
          email: args.userEmail,
          text: 'You have successfully enhanced your item',
        });
      } else {
        this.websocket.sendErrorNotification({
          email: args.userEmail,
          text: 'You have failed to enhance your item',
        });
      }

      await this.userWallet.removeSilverFromUser({ userEmail: args.userEmail, amount: price, tx });
      await this.userService.notifyUserUpdateWithProfile({ email: args.userEmail });
      return true;
    });
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
    });
  }

  private _deny(email: string, text: string) {
    this.websocket.sendErrorNotification({ email, text });
    return false;
  }
}
