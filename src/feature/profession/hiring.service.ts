import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { TRANSACTION_OPTIONS } from 'src/core/prisma/types/prisma';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { InventoryService } from 'src/feature/items/inventory.service';
import { enhanceChance, enhancePrice } from 'src/feature/items/items.rules';
import { ItemsValidator } from 'src/feature/items/items.validator';
import { UserStaminaService } from 'src/feature/users/userStamina.service';
import { UserWalletService } from 'src/feature/users/userWallet.service';
import { UsersService } from 'src/feature/users/users.service';
import { NotificationService } from 'src/feature/mail/notification.service';
import { Utils } from 'src/utilities/utils';
import { ProfessionService } from './profession.service';
import { ServiceOfferService } from './serviceOffer.service';
import {
  ENHANCE_SERVICE_STAMINA_COST,
  enhancementAfterFailure,
  hiredEnhanceChance,
  planIngredientConsumption,
  rollCraftQuality,
  serviceExperience,
  serviceFee,
} from './profession.rules';

/**
 * Hiring a crafter. The two sides of a job never mix: the hirer pays the silver
 * and provides the materials, and keeps whatever comes out; the crafter spends
 * the stamina and keeps the experience. Every job is one transaction, so a
 * crafter who runs out of stamina mid-job costs the hirer nothing.
 */
@Injectable()
export class HiringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly offers: ServiceOfferService,
    private readonly professions: ProfessionService,
    private readonly stamina: UserStaminaService,
    private readonly wallet: UserWalletService,
    private readonly inventory: InventoryService,
    private readonly userService: UsersService,
    private readonly notifications: NotificationService,
    private readonly websocket: WebsocketService,
  ) {}
  private readonly logger = new Logger('Hiring');

  /** The hirer's materials, the crafter's stamina, the hirer's item. */
  async hireCraft(args: { hirerEmail: string; offerId: number; recipeId: number }) {
    const offer = await this.offers.requireOffer({ offerId: args.offerId, service: 'crafting' });
    if (offer.crafterEmail === args.hirerEmail) {
      throw new BadRequestException('You do not need to hire yourself');
    }

    const recipe = await this.prisma.recipe.findUnique({
      where: { id: args.recipeId },
      include: { ingredients: true },
    });
    if (!recipe) {
      throw new BadRequestException('Recipe does not exist');
    }
    if (recipe.professionId !== offer.professionId) {
      throw new BadRequestException(`${offer.crafter.name} does not craft that`);
    }

    // The crafter's own level gates the job, exactly as if they crafted it for
    // themselves — hiring is not a way around a recipe's requirements. It is
    // also what the result's quality is rolled against, which is the reason to
    // hire a good one.
    const crafter = await this.professions.requireLearnedProfession({
      userEmail: offer.crafterEmail,
      professionId: recipe.professionId,
      requiredLevel: recipe.requiredLevel,
    });

    const owned = await this.prisma.inventoryItem.findMany({
      where: { userEmail: args.hirerEmail, equipped: false, locked: false, marketListing: null },
      orderBy: { stack: 'asc' },
    });
    const consumption = planIngredientConsumption({
      required: recipe.ingredients.map((i) => ({ itemId: i.itemId, amount: i.amount })),
      owned,
    });
    if (!consumption) {
      throw new BadRequestException('You are missing ingredients for this recipe');
    }

    const fee = serviceFee({ staminaCost: recipe.staminaCost, pricePerStamina: offer.pricePerStamina });
    const hirer = await this._requireSilver({ userEmail: args.hirerEmail, amount: fee });
    const quality = rollCraftQuality({ level: crafter.level });

    await this.prisma.$transaction(async (tx) => {
      // Throws when the crafter is out of stamina, which rolls back the payment
      // and the materials with it.
      await this.stamina.consumeStamina({ userEmail: offer.crafterEmail, amount: recipe.staminaCost, tx });
      for (const taken of consumption) {
        await this.inventory.removeItemFromInventory({
          userEmail: args.hirerEmail,
          inventoryId: taken.inventoryId,
          stack: taken.stack,
          tx,
        });
      }
      await this.inventory.addItemToInventory({
        userEmail: args.hirerEmail,
        itemId: recipe.itemId,
        stack: recipe.amount,
        quality,
        tx,
      });
      await this.professions.addExperience({
        userEmail: offer.crafterEmail,
        professionId: recipe.professionId,
        amount: recipe.experience,
        tx,
      });
      await this.wallet.transferSilverFromUserToUser({
        senderEmail: args.hirerEmail,
        receiverEmail: offer.crafterEmail,
        amount: fee,
        tx,
      });
      // Logged inside the job, so a rolled back job leaves no record of pay
      // that never happened.
      await this.notifications.notify({
        userEmail: offer.crafterEmail,
        type: 'hired_craft',
        title: `Crafted ${recipe.amount}x ${recipe.name} (quality ${quality})`,
        message: `${hirer.name} hired you to craft ${recipe.name}. It cost you ${recipe.staminaCost} energy.`,
        silver: fee,
        experience: recipe.experience,
        tx,
      });
    }, TRANSACTION_OPTIONS);

    this.logger.debug(`${offer.crafterEmail} crafted ${recipe.name} for ${args.hirerEmail} (${fee} silver)`);
    this.websocket.sendTextNotification({
      email: offer.crafterEmail,
      text: `You crafted ${recipe.name} for ${fee} silver`,
    });
    await this.notifications.push({ userEmail: offer.crafterEmail });
    await this._notifyBoth({ hirerEmail: args.hirerEmail, crafterEmail: offer.crafterEmail });

    return {
      recipe: recipe.name,
      amount: recipe.amount,
      experience: recipe.experience,
      quality,
      crafter: offer.crafter.name,
      crafterLevel: crafter.level,
      fee,
    };
  }

  /**
   * A hired enhancement. The forge cost is still burned by the hirer, on top of
   * the smith's fee, and the smith's level is what makes the roll better than
   * doing it alone.
   */
  async hireEnhance(args: { hirerEmail: string; offerId: number; inventoryId: number }) {
    const offer = await this.offers.requireOffer({ offerId: args.offerId, service: 'enhancing' });
    if (offer.crafterEmail === args.hirerEmail) {
      throw new BadRequestException('You do not need to hire yourself');
    }

    const blacksmith = await this.professions.requireLearnedProfession({
      userEmail: offer.crafterEmail,
      professionId: offer.professionId,
      requiredLevel: 1,
    });

    const inventoryItem = await this.inventory.getOneInventoryItem({
      userEmail: args.hirerEmail,
      inventoryId: args.inventoryId,
    });
    if (!inventoryItem) {
      throw new BadRequestException('You do not own that item');
    }
    if (inventoryItem.equipped) {
      throw new BadRequestException('Cannot enhance equipped item');
    }
    ItemsValidator.isEnhanceable({ category: inventoryItem.item.category });

    const nextEnhancement = inventoryItem.enhancement + 1;
    const forgePrice = enhancePrice({
      enhancement: nextEnhancement,
      requiredLevel: inventoryItem.item.requiredLevel,
      quality: inventoryItem.quality,
    });
    const fee = serviceFee({
      staminaCost: ENHANCE_SERVICE_STAMINA_COST,
      pricePerStamina: offer.pricePerStamina,
    });
    const hirer = await this._requireSilver({ userEmail: args.hirerEmail, amount: forgePrice + fee });

    const chance = hiredEnhanceChance({
      baseChance: enhanceChance(nextEnhancement),
      blacksmithLevel: blacksmith.level,
    });
    const success = Utils.isSuccess(chance);
    const enhancement = success ? nextEnhancement : enhancementAfterFailure({ current: inventoryItem.enhancement });

    await this.prisma.$transaction(async (tx) => {
      await this.stamina.consumeStamina({
        userEmail: offer.crafterEmail,
        amount: ENHANCE_SERVICE_STAMINA_COST,
        tx,
      });

      // The forge cost is spent on the attempt, the fee is earned by the smith:
      // both are paid whether the roll succeeds or not.
      await this.wallet.removeSilverFromUser({ userEmail: args.hirerEmail, amount: forgePrice, tx });
      await this.wallet.transferSilverFromUserToUser({
        senderEmail: args.hirerEmail,
        receiverEmail: offer.crafterEmail,
        amount: fee,
        tx,
      });

      if (enhancement !== inventoryItem.enhancement) {
        await this.inventory.removeItemFromInventory({
          userEmail: args.hirerEmail,
          inventoryId: args.inventoryId,
          stack: 1,
          tx,
        });
        await this.inventory.addItemToInventory({
          userEmail: args.hirerEmail,
          itemId: inventoryItem.itemId,
          quality: inventoryItem.quality,
          enhancement,
          stack: 1,
          tx,
        });
      }

      await this.professions.addExperience({
        userEmail: offer.crafterEmail,
        professionId: offer.professionId,
        amount: serviceExperience({ staminaCost: ENHANCE_SERVICE_STAMINA_COST }),
        tx,
      });
      await this.notifications.notify({
        userEmail: offer.crafterEmail,
        type: 'hired_enhance',
        title: success
          ? `Enhanced a ${inventoryItem.item.name} to +${nextEnhancement}`
          : `Failed to enhance a ${inventoryItem.item.name}`,
        message: `${hirer.name} hired your forge at ${chance}% odds. It cost you ${ENHANCE_SERVICE_STAMINA_COST} energy.`,
        silver: fee,
        experience: serviceExperience({ staminaCost: ENHANCE_SERVICE_STAMINA_COST }),
        tx,
      });
    }, TRANSACTION_OPTIONS);

    this.logger.debug(
      `${offer.crafterEmail} enhanced ${inventoryItem.item.name} for ${args.hirerEmail} — ${success ? 'success' : 'failure'} at ${chance}%`,
    );
    // Only the smith is told: the hirer is looking at the roll's animation.
    this.websocket.sendTextNotification({
      email: offer.crafterEmail,
      text: `You worked on a ${inventoryItem.item.name} for ${fee} silver`,
    });
    await this.notifications.push({ userEmail: offer.crafterEmail });
    await this._notifyBoth({ hirerEmail: args.hirerEmail, crafterEmail: offer.crafterEmail });

    return {
      item: inventoryItem.item.name,
      enhancement,
      success,
      setback: enhancement < inventoryItem.enhancement,
      chance,
      baseChance: enhanceChance(nextEnhancement),
      blacksmith: offer.crafter.name,
      blacksmithLevel: blacksmith.level,
      forgePrice,
      fee,
    };
  }

  /**
   * A blacksmith working on their own item: no hire, no fee, but the same
   * stamina cost and the same level bonus a customer would be paying for.
   */
  async selfAssistedEnhance(args: { userEmail: string; inventoryId: number }) {
    const learned = await this.professions.getUserProfession({ userEmail: args.userEmail });
    if (!learned?.profession.canEnhance) {
      throw new BadRequestException('Only a blacksmith can do that');
    }

    const inventoryItem = await this.inventory.getOneInventoryItem({
      userEmail: args.userEmail,
      inventoryId: args.inventoryId,
    });
    if (!inventoryItem) {
      throw new BadRequestException('You do not own that item');
    }
    if (inventoryItem.equipped) {
      throw new BadRequestException('Cannot enhance equipped item');
    }
    ItemsValidator.isEnhanceable({ category: inventoryItem.item.category });

    const nextEnhancement = inventoryItem.enhancement + 1;
    const forgePrice = enhancePrice({
      enhancement: nextEnhancement,
      requiredLevel: inventoryItem.item.requiredLevel,
      quality: inventoryItem.quality,
    });
    await this._requireSilver({ userEmail: args.userEmail, amount: forgePrice });

    const baseChance = enhanceChance(nextEnhancement);
    const chance = hiredEnhanceChance({ baseChance, blacksmithLevel: learned.level });
    const success = Utils.isSuccess(chance);
    const enhancement = success ? nextEnhancement : enhancementAfterFailure({ current: inventoryItem.enhancement });

    await this.prisma.$transaction(async (tx) => {
      await this.stamina.consumeStamina({
        userEmail: args.userEmail,
        amount: ENHANCE_SERVICE_STAMINA_COST,
        tx,
      });
      await this.wallet.removeSilverFromUser({ userEmail: args.userEmail, amount: forgePrice, tx });

      if (enhancement !== inventoryItem.enhancement) {
        await this.inventory.removeItemFromInventory({
          userEmail: args.userEmail,
          inventoryId: args.inventoryId,
          stack: 1,
          tx,
        });
        await this.inventory.addItemToInventory({
          userEmail: args.userEmail,
          itemId: inventoryItem.itemId,
          quality: inventoryItem.quality,
          enhancement,
          stack: 1,
          tx,
        });
      }

      await this.professions.addExperience({
        userEmail: args.userEmail,
        professionId: learned.professionId,
        amount: serviceExperience({ staminaCost: ENHANCE_SERVICE_STAMINA_COST }),
        tx,
      });
    }, TRANSACTION_OPTIONS);

    this.logger.debug(
      `${args.userEmail} worked their own ${inventoryItem.item.name} — ${success ? 'success' : 'failure'} at ${chance}%`,
    );
    // The outcome is returned to the screen that asked for it, so there is
    // nothing to announce here.
    await this.userService.notifyUserUpdateWithProfile({ email: args.userEmail });

    return {
      item: inventoryItem.item.name,
      enhancement,
      success,
      setback: enhancement < inventoryItem.enhancement,
      chance,
      baseChance,
      blacksmithLevel: learned.level,
      forgePrice,
      fee: 0,
    };
  }

  private async _requireSilver(args: { userEmail: string; amount: number }) {
    const user = await this.prisma.user.findUnique({ where: { email: args.userEmail } });
    if (!user) {
      throw new BadRequestException('User not registered');
    }
    if (user.silver < args.amount) {
      throw new BadRequestException('You are too poor for that');
    }
    return user;
  }

  /** Both sides changed: silver, stamina, inventory and profession level. */
  private async _notifyBoth(args: { hirerEmail: string; crafterEmail: string }) {
    await this.userService.notifyUserUpdateWithProfile({ email: args.hirerEmail });
    await this.userService.notifyUserUpdateWithProfile({ email: args.crafterEmail });
  }
}
