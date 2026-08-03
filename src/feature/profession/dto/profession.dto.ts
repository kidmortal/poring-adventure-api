import { IsBoolean, IsNotEmpty } from 'class-validator';

/** Learning addresses one profession. */
export class ProfessionIdDto {
  @IsNotEmpty()
  professionId: number;
}

/** Gathering addresses one node, which already knows its profession. */
export class GatheringNodeIdDto {
  @IsNotEmpty()
  nodeId: number;
}

/** Crafting addresses one recipe, which already knows its profession. */
export class RecipeIdDto {
  @IsNotEmpty()
  recipeId: number;
}

/** Filling one contract off today's board. */
export class CommissionIdDto {
  @IsNotEmpty()
  commissionId: number;
}

/** Publishing an offer: the profession is whichever one the crafter practices. */
export class PublishServiceOfferDto {
  @IsNotEmpty()
  pricePerStamina: number;

  @IsBoolean()
  crafting: boolean;

  @IsBoolean()
  enhancing: boolean;
}

/** Hiring a crafter for one recipe. */
export class HireCraftDto {
  @IsNotEmpty()
  offerId: number;

  @IsNotEmpty()
  recipeId: number;
}

/** A blacksmith working on one of their own items. */
export class InventoryIdDto {
  @IsNotEmpty()
  inventoryId: number;
}

/** Hiring a blacksmith to enhance one item you own. */
export class HireEnhanceDto {
  @IsNotEmpty()
  offerId: number;

  @IsNotEmpty()
  inventoryId: number;
}
