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
