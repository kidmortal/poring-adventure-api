import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { TRANSACTION_OPTIONS } from 'src/core/prisma/types/prisma';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { UsersService } from 'src/feature/users/users.service';
import { UserStatsService } from 'src/feature/users/userStats.service';
import { UserWalletService } from 'src/feature/users/userWallet.service';
import { enhancementAfterFailure } from 'src/feature/profession/profession.rules';
import { Utils } from 'src/utilities/utils';
import { EQUIPABLE_CATEGORIES } from './entities/categories';
import { InventoryService } from './inventory.service';
import {
  buffDurationForQuality,
  canUpgradeQuality,
  consumablePotency,
  enhanceChance,
  enhancePrice,
  MAX_QUALITY,
  UPGRADE_MIN_ENHANCEMENT,
  upgradeChance,
} from './items.rules';

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
    if (!EQUIPABLE_CATEGORIES.includes(inventoryItem.item.category)) {
      return this._deny(args.userEmail, 'Only equipment can be enhanced');
    }
    if (!this._hasSpareStack(inventoryItem)) {
      return this._deny(args.userEmail, 'Cannot enhance an item that is listed on the market');
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
    // Priced off what the enhancement is worth, which is decided by the tier of
    // gear it is going on and by its rarity — not by the level alone.
    const price = enhancePrice({
      enhancement: nextEnhancement,
      requiredLevel: inventoryItem.item.requiredLevel,
      quality: inventoryItem.quality,
    });
    if (wallet.silver < price) {
      return this._deny(args.userEmail, 'Not enough silver');
    }

    const chance = enhanceChance(nextEnhancement);
    const success = Utils.isSuccess(chance);
    // High enhancement is a standing relationship with a smith rather than a
    // one-time errand: past +6 a failure takes a level back, though never below
    // the floor, so no single click can undo a week of work.
    const enhancement = success ? nextEnhancement : enhancementAfterFailure({ current: inventoryItem.enhancement });
    const setback = enhancement < inventoryItem.enhancement;

    // What has to be atomic, and nothing else: paying for the attempt and
    // applying what it rolled.
    await this.prisma.$transaction(async (tx) => {
      if (enhancement !== inventoryItem.enhancement) {
        await this.inventory.removeItemFromInventory({ ...args, stack: 1, tx });
        await this.inventory.addItemToInventory({
          itemId: inventoryItem.itemId,
          quality: inventoryItem.quality,
          enhancement,
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
      enhancement,
      success,
      setback,
      chance,
      forgePrice: price,
    };
  }

  /**
   * Feeds a duplicate of the item into it for a chance at the next rarity.
   *
   * The material has to be the same item at the same quality, but its own
   * enhancement is not read at all — which is the point. Gear falls off monsters
   * constantly and nobody wears the fourth copy of a tier-2 helmet, so this is
   * where those copies go; the drop table stops being noise and becomes the
   * supply line for rarity.
   *
   * Both outcomes cost the same: the duplicate is gone and the enhancement is
   * back at +0. Losing the +5 is the whole price of the roll — the silver
   * already spent getting there is what the player is really gambling, and it is
   * why the odds are generous at the bottom and cruel at the top.
   */
  async upgradeItem(args: { userEmail: string; inventoryId: number; materialInventoryId?: number }) {
    const inventoryItem = await this.inventory.getOneInventoryItem(args);
    if (!inventoryItem) return false;

    if (inventoryItem.equipped) {
      return this._deny(args.userEmail, 'Cannot upgrade equipped item');
    }
    if (!EQUIPABLE_CATEGORIES.includes(inventoryItem.item.category)) {
      return this._deny(args.userEmail, 'Only equipment can be upgraded');
    }
    if (!this._hasSpareStack(inventoryItem)) {
      return this._deny(args.userEmail, 'Cannot upgrade an item that is listed on the market');
    }
    if (inventoryItem.quality >= MAX_QUALITY) {
      return this._deny(args.userEmail, 'This item is already Legendary');
    }
    if (!canUpgradeQuality(inventoryItem)) {
      return this._deny(args.userEmail, `Requires +${UPGRADE_MIN_ENHANCEMENT} before its rarity can be raised`);
    }

    const material = await this._findUpgradeMaterial({
      userEmail: args.userEmail,
      target: inventoryItem,
      materialInventoryId: args.materialInventoryId,
    });
    if (!material) {
      return this._deny(args.userEmail, `Needs a spare ${inventoryItem.item.name} of the same rarity to consume`);
    }

    const chance = upgradeChance(inventoryItem.quality);
    const success = Utils.isSuccess(chance);
    const quality = success ? inventoryItem.quality + 1 : inventoryItem.quality;

    await this.prisma.$transaction(async (tx) => {
      // The material goes first: when it is the same stack as the target — two
      // copies both sitting at the same +5 merge into one row — taking it off
      // the front leaves exactly the one copy the roll is being made on.
      await this.inventory.removeItemFromInventory({
        userEmail: args.userEmail,
        inventoryId: material.id,
        stack: 1,
        tx,
      });
      await this.inventory.removeItemFromInventory({ ...args, stack: 1, tx });
      await this.inventory.addItemToInventory({
        itemId: inventoryItem.itemId,
        userEmail: args.userEmail,
        quality,
        enhancement: 0,
        stack: 1,
        tx,
      });
    }, TRANSACTION_OPTIONS);

    await this.userService.notifyUserUpdateWithProfile({ email: args.userEmail });

    return {
      item: inventoryItem.item.name,
      success,
      chance,
      quality,
      previousQuality: inventoryItem.quality,
      enhancement: 0,
      previousEnhancement: inventoryItem.enhancement,
      consumedEnhancement: material.enhancement,
    };
  }

  /**
   * The duplicate that will be eaten. Named explicitly when the player picked
   * one, and otherwise the least enhanced copy they own — feeding a +7 into a +5
   * is never what somebody meant, and this is a sink for the copies nobody was
   * doing anything with.
   *
   * Locked and equipped stacks are out of reach on purpose, and so is anything
   * already promised to a market listing.
   */
  private async _findUpgradeMaterial(args: {
    userEmail: string;
    target: { id: number; itemId: number; quality: number };
    materialInventoryId?: number;
  }) {
    const candidates = await this.prisma.inventoryItem.findMany({
      where: {
        userEmail: args.userEmail,
        itemId: args.target.itemId,
        quality: args.target.quality,
        equipped: false,
        locked: false,
        ...(args.materialInventoryId ? { id: args.materialInventoryId } : {}),
      },
      include: { marketListing: true },
      orderBy: { enhancement: 'asc' },
    });

    return candidates.find((candidate) => {
      const available = candidate.stack - (candidate.marketListing?.stack ?? 0);
      // The target's own row only qualifies when it holds a second copy, since
      // one of them is the item being upgraded rather than the fuel.
      return candidate.id === args.target.id ? available >= 2 : available >= 1;
    });
  }

  /**
   * Eats or drinks one stack: restores what it restores, grants what it grants,
   * and leaves the inventory either way.
   *
   * Both halves are scaled by the stack's quality, which used to be ignored
   * outright — a Legendary potion healed exactly as much as a Common one, so a
   * master alchemist's work was worth nothing more than a beginner's. A meal
   * marked `partyWide` feeds everyone in the party, which is what makes a cook
   * something a group brings along rather than a personal luxury.
   */
  async consumeItem(args: { userEmail: string; inventoryId: number; stack: number }) {
    const inventoryItem = await this.inventory.getOneInventoryItem(args);
    if (inventoryItem?.item.category !== 'consumable') return false;

    const { item, quality } = inventoryItem;
    const health = consumablePotency({ base: item.health, quality });
    const mana = consumablePotency({ base: item.mana, quality });
    const fed = item.buff ? await this._buffTargets({ item, userEmail: args.userEmail }) : [];

    await this.prisma.$transaction(async (tx) => {
      if (health) {
        await this.userStats.incrementUserHealth({ userEmail: args.userEmail, amount: health, tx });
      }
      if (mana) {
        await this.userStats.incrementUserMana({ userEmail: args.userEmail, amount: mana, tx });
      }
      for (const email of fed) {
        await this.userStats.applyBuff({
          userEmail: email,
          buff: item.buff,
          duration: buffDurationForQuality({ duration: item.buff.duration, quality }),
          tx,
        });
      }
      await this.inventory.removeItemFromInventory({ ...args, tx });
    }, TRANSACTION_OPTIONS);

    // Everyone the meal reached sees it, not only whoever paid for it.
    for (const email of fed) {
      await this.userService.notifyUserUpdateWithProfile({ email });
    }
    if (!fed.includes(args.userEmail)) {
      await this.userService.notifyUserUpdateWithProfile({ email: args.userEmail });
    }

    return {
      item: item.name,
      quality,
      health,
      mana,
      buff: item.buff
        ? {
            name: item.buff.name,
            image: item.buff.image,
            duration: buffDurationForQuality({ duration: item.buff.duration, quality }),
            attackBonus: item.buff.attackBonus,
            healthBonus: item.buff.healthBonus,
            fed: fed.length,
          }
        : null,
    };
  }

  /**
   * Who a buffed consumable actually reaches. A party-wide meal covers the
   * whole party — including the eater — and everything else covers one person.
   */
  private async _buffTargets(args: { item: { partyWide: boolean }; userEmail: string }) {
    if (!args.item.partyWide) return [args.userEmail];

    const user = await this.prisma.user.findUnique({
      where: { email: args.userEmail },
      select: { partyId: true },
    });
    if (!user?.partyId) return [args.userEmail];

    const party = await this.prisma.user.findMany({
      where: { partyId: user.partyId },
      select: { email: true },
    });
    return party.map((member) => member.email);
  }

  /**
   * Whether a copy is actually free to be worked on, rather than promised to a
   * listing on the board.
   *
   * Both enhancing and upgrading move the item to a different stack, which
   * deletes the row it left — and `MarketListing` cascades on that row, so a
   * player who enhanced the last copy of something they had for sale would have
   * watched the sale vanish with no refund and no explanation. Equipping has
   * always checked this (`ItemsValidator.hasRemainingStock`); these two did not.
   */
  private _hasSpareStack(inventoryItem: { stack: number; marketListing?: { stack: number } | null }) {
    return inventoryItem.stack - (inventoryItem.marketListing?.stack ?? 0) >= 1;
  }

  private _deny(email: string, text: string) {
    this.websocket.sendErrorNotification({ email, text });
    return false;
  }
}
