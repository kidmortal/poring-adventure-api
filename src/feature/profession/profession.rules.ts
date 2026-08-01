import { Utils } from 'src/utilities/utils';

type DropChance = { itemId: number; chance: number; minAmount: number; maxAmount: number };
export type RolledDrop = { itemId: number; amount: number };

/** Stamina a hired enhancement costs the blacksmith, whatever the item is. */
export const ENHANCE_SERVICE_STAMINA_COST = 10;

/** Profession experience the blacksmith earns per enhancement attempt. */
export const ENHANCE_SERVICE_EXPERIENCE = 20;

/** A hired job is priced off the stamina it burns, not off what it produces. */
export function serviceFee(args: { staminaCost: number; pricePerStamina: number }) {
  return args.staminaCost * args.pricePerStamina;
}

/**
 * A hired blacksmith enhances better than you do: every level adds two points
 * to the base chance. Capped short of certainty so a high level smith is worth
 * hiring without making enhancement free of risk.
 */
export function hiredEnhanceChance(args: { baseChance: number; blacksmithLevel: number }) {
  return Math.min(args.baseChance + args.blacksmithLevel * 2, 95);
}

/**
 * Every drop of a node is rolled once and independently, so a lucky gather can
 * return the whole table and an unlucky one nothing at all.
 */
export function rollNodeDrops(drops: DropChance[]): RolledDrop[] {
  const rolled: RolledDrop[] = [];
  for (const drop of drops) {
    if (!Utils.isSuccess(drop.chance)) continue;
    const amount = Utils.getRandomNumberBetween(drop.minAmount, drop.maxAmount);
    if (amount > 0) {
      rolled.push({ itemId: drop.itemId, amount });
    }
  }
  return rolled;
}

/**
 * Ingredients are matched by item id across every stack the user owns, because
 * the same material can sit in several stacks with different quality. Returns
 * which stacks to consume, or null when the user is short.
 */
export function planIngredientConsumption(args: {
  required: { itemId: number; amount: number }[];
  owned: { id: number; itemId: number; stack: number }[];
}): { inventoryId: number; stack: number }[] | null {
  const plan: { inventoryId: number; stack: number }[] = [];

  for (const ingredient of args.required) {
    let missing = ingredient.amount;
    const stacks = args.owned.filter((item) => item.itemId === ingredient.itemId);

    for (const stack of stacks) {
      if (missing <= 0) break;
      const taken = Math.min(stack.stack, missing);
      plan.push({ inventoryId: stack.id, stack: taken });
      missing -= taken;
    }

    if (missing > 0) return null;
  }

  return plan;
}
