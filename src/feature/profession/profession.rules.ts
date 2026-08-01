import { Utils } from 'src/utilities/utils';

type DropChance = { itemId: number; chance: number; minAmount: number; maxAmount: number };
export type RolledDrop = { itemId: number; amount: number };

/** Stamina a hired enhancement costs the blacksmith, whatever the item is. */
export const ENHANCE_SERVICE_STAMINA_COST = 10;

/** Every stamina point spent on a service is worth this much experience. */
export const EXPERIENCE_PER_STAMINA = 2;

/** What a service job pays the worker in profession experience. */
export function serviceExperience(args: { staminaCost: number }) {
  return args.staminaCost * EXPERIENCE_PER_STAMINA;
}

/** A hired job is priced off the stamina it burns, not off what it produces. */
export function serviceFee(args: { staminaCost: number; pricePerStamina: number }) {
  return args.staminaCost * args.pricePerStamina;
}

/**
 * A hired blacksmith enhances better than you do: each of their levels adds a
 * tenth of the base chance, so the boost is worth most where the odds are
 * already decent and never turns a hopeless attempt into a sure thing.
 */
export function hiredEnhanceBonus(args: { baseChance: number; blacksmithLevel: number }) {
  const bonus = Math.round(args.baseChance * 0.1 * args.blacksmithLevel);
  return Math.min(bonus, 100 - args.baseChance);
}

export function hiredEnhanceChance(args: { baseChance: number; blacksmithLevel: number }) {
  return args.baseChance + hiredEnhanceBonus(args);
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

/**
 * Quality a craft can roll: 1 Common through 5 Legendary. Mythical is not on the
 * table — it is not something a workshop produces.
 */
export type QualityChance = { quality: number; chance: number };

/**
 * How likely each quality is for a crafter of this level. Every level shifts
 * weight out of Common and into the tiers above it, and each tier has a ceiling
 * so a veteran is reliably good rather than guaranteed legendary. The rates are
 * deliberately generous — a tier that used to need twenty levels lands around
 * ten — because grinding to a first Rare was taking far too long.
 */
export function craftQualityChances(args: { level: number }): QualityChance[] {
  const level = Math.max(args.level, 1);
  const uncommon = Math.min(level * 6, 40);
  const rare = Math.min(Math.floor(level * 3), 25);
  const epic = Math.min(Math.floor(level * 1.2), 12);
  const legendary = Math.min(Math.floor(level * 0.4), 8);
  const common = 100 - uncommon - rare - epic - legendary;

  return [
    { quality: 1, chance: common },
    { quality: 2, chance: uncommon },
    { quality: 3, chance: rare },
    { quality: 4, chance: epic },
    { quality: 5, chance: legendary },
  ];
}

/** Rolls one quality off that table. */
export function rollCraftQuality(args: { level: number }): number {
  const roll = Math.random() * 100;
  let passed = 0;

  for (const entry of craftQualityChances(args)) {
    passed += entry.chance;
    if (roll < passed) return entry.quality;
  }
  return 1;
}
