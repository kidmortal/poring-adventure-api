import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { InventoryService } from 'src/feature/items/inventory.service';
import { UserStaminaService } from 'src/feature/users/userStamina.service';
import { UserWalletService } from 'src/feature/users/userWallet.service';
import { UsersService } from 'src/feature/users/users.service';
import { Utils } from 'src/utilities/utils';
import { ProfessionService } from './profession.service';
import { ServiceOfferService } from './serviceOffer.service';
import {
  ENHANCE_SERVICE_EXPERIENCE,
  ENHANCE_SERVICE_STAMINA_COST,
  hiredEnhanceChance,
  planIngredientConsumption,
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
    // themselves — hiring is not a way around a recipe's requirements.
    await this.professions.requireLearnedProfession({
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
    await this._requireSilver({ userEmail: args.hirerEmail, amount: fee });

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
    });

    this.logger.debug(`${offer.crafterEmail} crafted ${recipe.name} for ${args.hirerEmail} (${fee} silver)`);
    this.websocket.sendTextNotification({
      email: offer.crafterEmail,
      text: `You crafted ${recipe.name} for ${fee} silver`,
    });
    await this._notifyBoth({ hirerEmail: args.hirerEmail, crafterEmail: offer.crafterEmail });

    return {
      recipe: recipe.name,
      amount: recipe.amount,
      experience: recipe.experience,
      crafter: offer.crafter.name,
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

    const nextEnhancement = inventoryItem.enhancement + 1;
    const forgePrice = Utils.enhancePrice(nextEnhancement);
    const fee = serviceFee({
      staminaCost: ENHANCE_SERVICE_STAMINA_COST,
      pricePerStamina: offer.pricePerStamina,
    });
    await this._requireSilver({ userEmail: args.hirerEmail, amount: forgePrice + fee });

    const chance = hiredEnhanceChance({
      baseChance: Utils.enhanceChance(nextEnhancement),
      blacksmithLevel: blacksmith.level,
    });
    const success = Utils.isSuccess(chance);

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

      if (success) {
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
          enhancement: nextEnhancement,
          stack: 1,
          tx,
        });
      }

      await this.professions.addExperience({
        userEmail: offer.crafterEmail,
        professionId: offer.professionId,
        amount: ENHANCE_SERVICE_EXPERIENCE,
        tx,
      });
    });

    this.logger.debug(
      `${offer.crafterEmail} enhanced ${inventoryItem.item.name} for ${args.hirerEmail} — ${success ? 'success' : 'failure'} at ${chance}%`,
    );
    this._notifyEnhanceResult({
      hirerEmail: args.hirerEmail,
      offer: { crafterEmail: offer.crafterEmail, crafterName: offer.crafter.name },
      itemName: inventoryItem.item.name,
      success,
      fee,
    });
    await this._notifyBoth({ hirerEmail: args.hirerEmail, crafterEmail: offer.crafterEmail });

    return {
      item: inventoryItem.item.name,
      enhancement: success ? nextEnhancement : inventoryItem.enhancement,
      success,
      chance,
      blacksmith: offer.crafter.name,
      blacksmithLevel: blacksmith.level,
      forgePrice,
      fee,
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

  private _notifyEnhanceResult(args: {
    hirerEmail: string;
    offer: { crafterEmail: string; crafterName: string };
    itemName: string;
    success: boolean;
    fee: number;
  }) {
    if (args.success) {
      this.websocket.sendTextNotification({
        email: args.hirerEmail,
        text: `${args.offer.crafterName} enhanced your ${args.itemName}`,
      });
    } else {
      this.websocket.sendErrorNotification({
        email: args.hirerEmail,
        text: `${args.offer.crafterName} failed to enhance your ${args.itemName}`,
      });
    }
    this.websocket.sendTextNotification({
      email: args.offer.crafterEmail,
      text: `You worked on a ${args.itemName} for ${args.fee} silver`,
    });
  }

  /** Both sides changed: silver, stamina, inventory and profession level. */
  private async _notifyBoth(args: { hirerEmail: string; crafterEmail: string }) {
    await this.userService.notifyUserUpdateWithProfile({ email: args.hirerEmail });
    await this.userService.notifyUserUpdateWithProfile({ email: args.crafterEmail });
  }
}
