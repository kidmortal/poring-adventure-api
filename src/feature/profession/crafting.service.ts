import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { TRANSACTION_OPTIONS } from 'src/core/prisma/types/prisma';
import { InventoryService } from 'src/feature/items/inventory.service';
import { UserStaminaService } from 'src/feature/users/userStamina.service';
import { UsersService } from 'src/feature/users/users.service';
import { ProfessionService } from './profession.service';
import { planIngredientConsumption, rollCraftQuality } from './profession.rules';
import { ITEM_WITH_BUFF } from 'src/feature/items/entities/itemInclude';

/**
 * Crafting: ingredients plus stamina in, one item out. Nothing is random —
 * the recipe's required level is what gates it — so a craft either happens in
 * full or fails before anything is spent.
 */
@Injectable()
export class CraftingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly professions: ProfessionService,
    private readonly stamina: UserStaminaService,
    private readonly inventory: InventoryService,
    private readonly userService: UsersService,
  ) {}
  private readonly logger = new Logger('Crafting');

  getAllRecipes() {
    return this.prisma.recipe.findMany({
      include: { profession: true, item: ITEM_WITH_BUFF, ingredients: { include: { item: ITEM_WITH_BUFF } } },
      orderBy: [{ professionId: 'asc' }, { requiredLevel: 'asc' }],
    });
  }

  async craft(args: { userEmail: string; recipeId: number }) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: args.recipeId },
      include: { ingredients: true },
    });
    if (!recipe) {
      throw new BadRequestException('Recipe does not exist');
    }

    const learned = await this.professions.requireLearnedProfession({
      userEmail: args.userEmail,
      professionId: recipe.professionId,
      requiredLevel: recipe.requiredLevel,
    });

    // Equipped or listed stacks are left alone: crafting must not silently
    // strip the gear a player is wearing.
    const owned = await this.prisma.inventoryItem.findMany({
      where: { userEmail: args.userEmail, equipped: false, locked: false, marketListing: null },
      orderBy: { stack: 'asc' },
    });
    const consumption = planIngredientConsumption({
      required: recipe.ingredients.map((i) => ({ itemId: i.itemId, amount: i.amount })),
      owned,
    });
    if (!consumption) {
      throw new BadRequestException('You are missing ingredients for this recipe');
    }

    // The crafter's level is what decides how good the result comes out.
    const quality = rollCraftQuality({ level: learned.level });

    await this.prisma.$transaction(async (tx) => {
      await this.stamina.consumeStamina({ userEmail: args.userEmail, amount: recipe.staminaCost, tx });
      for (const taken of consumption) {
        await this.inventory.removeItemFromInventory({
          userEmail: args.userEmail,
          inventoryId: taken.inventoryId,
          stack: taken.stack,
          tx,
        });
      }
      await this.inventory.addItemToInventory({
        userEmail: args.userEmail,
        itemId: recipe.itemId,
        stack: recipe.amount,
        quality,
        tx,
      });
      await this.professions.addExperience({
        userEmail: args.userEmail,
        professionId: recipe.professionId,
        amount: recipe.experience,
        tx,
      });
    }, TRANSACTION_OPTIONS);

    this.logger.debug(`${args.userEmail} crafted ${recipe.name} at quality ${quality}`);
    await this.userService.notifyUserUpdateWithProfile({ email: args.userEmail });
    return { recipe: recipe.name, amount: recipe.amount, experience: recipe.experience, quality };
  }
}
