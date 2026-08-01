import { IsNotEmpty } from 'class-validator';

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
