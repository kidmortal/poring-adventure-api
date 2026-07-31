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
  };
}
