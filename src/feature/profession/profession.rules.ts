import { Utils } from 'src/utilities/utils';

type DropChance = { itemId: number; chance: number; minAmount: number; maxAmount: number };
export type RolledDrop = { itemId: number; amount: number };

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
