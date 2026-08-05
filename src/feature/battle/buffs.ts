import { Buff } from '@prisma/client';

/**
 * Buffs as they sit at the table, on either side of the fight.
 *
 * A player's buff is a `UserBuff` row with the catalogue entry hanging off it;
 * a monster's exists only for the length of the battle. What they have in
 * common is the pair this file cares about — the entry and what is left of its
 * duration — so both are handled here rather than twice.
 *
 * What a buff *does* to a player is still `effects.ts`, which hooks each damage
 * step. A monster has no such hooks, so its buffs are read the way debuffs are:
 * plain queries over the list at the two moments that matter.
 */
export type BuffCarrier = {
  buffs: { buff: Buff; duration: number }[];
};

/** No pile of buffs may take more than this share off the damage taken. */
const MAX_DAMAGE_REDUCTION = 0.5;

/**
 * Puts a buff on a carrier — one copy, and re-applying refreshes it.
 *
 * The same buff twice was two icons and two multipliers: a Priest blessing the
 * party every turn stacked their own blessing on top of itself, and the debug
 * panel could pile up as many as it was clicked. It is one entry now, refreshed
 * to the longer of what is left and what is arriving, so re-casting extends a
 * blessing rather than doubling it and never cuts a longer one short.
 *
 * `Buff.maxStack` deliberately does not gate this. On a meal it means something
 * else entirely — the ceiling on *banked duration* across battles, enforced
 * where food is eaten — and reading it as a copy count here would let two
 * dinners become two multipliers.
 */
export function applyBuff(args: { target: BuffCarrier; buff: Buff; duration?: number; barrier?: number }) {
  const duration = args.duration ?? args.buff.duration;
  const existing = args.target.buffs.find((held) => held.buff.name === args.buff.name);

  if (existing) {
    existing.duration = Math.max(existing.duration, duration);
    return false;
  }

  args.target.buffs.push({
    duration,
    id: 0,
    userEmail: '',
    buffId: args.buff.id,
    // A copy, so nothing at the table can write back into the shared catalogue
    // row hanging off a skill definition.
    buff: { ...args.buff },
    barrier: args.barrier,
  } as BuffCarrier['buffs'][number]);
  return true;
}

function totalBonus(carrier: BuffCarrier, read: (buff: Buff) => number | null | undefined) {
  return carrier.buffs.reduce((total, held) => total + (read(held.buff) ?? 0), 0);
}

/** What a buffed monster swings for. */
export function buffedAttack(carrier: BuffCarrier, attack: number) {
  const bonus = totalBonus(carrier, (buff) => buff.attackBonus);
  if (bonus <= 0) return attack;
  return Math.max(1, Math.floor(attack * (1 + bonus / 100)));
}

/**
 * What a hit on a buffed monster is worth after its protection.
 *
 * The health share is read as damage reduction rather than as a bigger pool,
 * for the same reason it is on a player: a buff that raised maximum health mid
 * fight would have to be unwound when it expired.
 */
export function buffedDamageTaken(carrier: BuffCarrier, damage: number) {
  const bonus = totalBonus(carrier, (buff) => buff.healthBonus);
  if (bonus <= 0) return damage;
  return Math.max(1, Math.floor(damage * (1 - Math.min(bonus / 100, MAX_DAMAGE_REDUCTION))));
}

/** Ticks a monster's buffs down by one of its own turns and drops the spent ones. */
export function tickBuffs(carrier: BuffCarrier) {
  carrier.buffs.forEach((held) => (held.duration -= 1));
  const expired = carrier.buffs.filter((held) => held.duration < 1);
  carrier.buffs = carrier.buffs.filter((held) => held.duration >= 1);
  return expired;
}
