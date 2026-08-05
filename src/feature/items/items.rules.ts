import { Item } from '@prisma/client';
import { Utils } from 'src/utilities/utils';

/** Pure item maths — no database, no cache, no sockets. */

export type ItemStatBlock = {
  health: number;
  mana: number;
  attack: number;
  str: number;
  agi: number;
  int: number;
  defense: number;
  critRate: number;
  critDamage: number;
};

/**
 * The stats an item actually grants once its quality and enhancement are
 * factored in. Used on both equip and unequip, so the two always agree.
 */
export function itemStatBlock(args: { item: Item; quality?: number; enhancement?: number }): ItemStatBlock {
  const multiplier = Utils.itemStatsMultiplier(args.quality ?? 0, args.enhancement ?? 0);
  const scale = (value: number) => Math.floor((value ?? 0) * multiplier);

  return {
    health: scale(args.item.health),
    mana: scale(args.item.mana),
    attack: scale(args.item.attack),
    str: scale(args.item.str),
    agi: scale(args.item.agi),
    int: scale(args.item.int),
    defense: scale(args.item.defense),
    critRate: scale(args.item.critRate),
    critDamage: scale(args.item.critDamage),
  };
}

/** The top of the quality ladder — Legendary. Nothing upgrades past it. */
export const MAX_QUALITY = 5;

/**
 * Where an item has to be before its rarity can be raised. A player has to have
 * finished a run of enhancement on it first, which is what makes the upgrade a
 * decision rather than the first thing anyone does with a fresh drop.
 */
export const UPGRADE_MIN_ENHANCEMENT = 5;

/**
 * The odds of the rarity actually moving, read off the quality it is leaving.
 * They fall away sharply because the item being fed in is a monster drop and
 * costs nothing but the time it took to find — a 10% Legendary is the whole
 * reason a party keeps picking up gear it will never wear.
 */
export function upgradeChance(quality: number) {
  switch (Math.max(quality, 1)) {
    case 1:
      return 70;
    case 2:
      return 50;
    case 3:
      return 30;
    case 4:
      return 10;
    default:
      return 0;
  }
}

/** Whether this stack is far enough along, and low enough, to be upgraded. */
export function canUpgradeQuality(args: { quality: number; enhancement: number }) {
  return args.quality < MAX_QUALITY && args.enhancement >= UPGRADE_MIN_ENHANCEMENT;
}

/**
 * The odds of an enhancement landing: 100% at +1, losing a tenth of whatever is
 * left each level after. Deliberately blind to what the item is — the risk is
 * the same on every piece of gear, and it is the *price* that knows the
 * difference.
 */
export function enhanceChance(enhancement: number) {
  let chance = 100;
  for (let level = 0; level < enhancement; level++) {
    chance -= Math.round(chance * 0.1);
  }
  return chance;
}

/** Every tier of rarity makes the forge charge half again as much. */
const PRICE_PER_QUALITY = 0.5;

/** And every level of gear a tenth as much on top of that. */
const PRICE_PER_ITEM_LEVEL = 0.1;

/**
 * What the forge charges for one attempt.
 *
 * The curve on the enhancement level is the old one — 100 silver, half again
 * per level — but it used to be the *whole* price, which meant a +10 on a
 * level-1 Common cotton shirt cost exactly what a +10 on a Legendary level-50
 * blade did. Since enhancement is worth five times as much on a Legendary as on
 * a Common (`itemStatsMultiplier`), that was the cheapest power in the game
 * sitting next to the most expensive, at the same price.
 *
 * So the two things that decide what the enhancement is *worth* now decide what
 * it costs: the item's `requiredLevel` and its quality.
 */
export function enhancePrice(args: { enhancement: number; requiredLevel?: number; quality?: number }) {
  let base = 100;
  for (let level = 0; level < args.enhancement; level++) {
    base += Math.round(base * 0.5);
  }

  const levelFactor = 1 + (Math.max(args.requiredLevel ?? 1, 1) - 1) * PRICE_PER_ITEM_LEVEL;
  const qualityFactor = 1 + (Math.max(args.quality ?? 1, 1) - 1) * PRICE_PER_QUALITY;
  return Math.floor(base * levelFactor * qualityFactor);
}

/**
 * What a consumable actually restores. Enhancement is deliberately left out —
 * a potion is never enhanced — but quality is not: a Legendary potion off a
 * level-20 alchemist's bench is the whole reason to hire one instead of the
 * cheapest crafter on the board.
 */
export function consumablePotency(args: { base?: number | null; quality?: number }) {
  if (!args.base) return 0;
  return Math.floor(args.base * Utils.qualityMultiplier(args.quality ?? 1));
}

/**
 * How long a buff lasts once quality is taken into account. A better cook does
 * not make a stronger meal — the buff's percentages are fixed by the recipe —
 * they make one that lasts, which is the version that stays easy to reason
 * about when several meals stack.
 */
export function buffDurationForQuality(args: { duration: number; quality?: number }) {
  return Math.max(1, Math.floor(args.duration * Utils.qualityMultiplier(args.quality ?? 1)));
}
