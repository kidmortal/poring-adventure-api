import { Buff, UserBuff } from '@prisma/client';

/**
 * Critical hits. Pure maths — no database, no cache, no sockets.
 *
 * A crit is a flat percentage roll rather than anything derived from a stat,
 * because it has to read the same on a heal as on a hit: the Priest topping the
 * party up and the Rune Knight swinging at the boss are rolling the same dice.
 * Buffs are what a build ends up standing on, and they never crit themselves —
 * a doubled duration or a doubled barrier would be a different mechanic wearing
 * the same name.
 */

/** What a character has before a single point of gear. */
export const BASE_CRIT_RATE = 5;
export const BASE_CRIT_DAMAGE = 200;

/**
 * A crit is never a certainty. Left uncapped, enough accessories would turn the
 * roll off entirely and take the variance — the reason it is fun — with it.
 */
export const MAX_CRIT_RATE = 75;

type BuffLike = UserBuff & { buff: Buff };

type CritStats = { critRate?: number; critDamage?: number };

/** The rate the character actually rolls against, gear and buffs included. */
export function critRate(args: { stats: CritStats; buffs?: BuffLike[] }) {
  const fromBuffs = (args.buffs ?? []).reduce((total, held) => total + (held.buff?.critRateBonus ?? 0), 0);
  const total = (args.stats.critRate ?? BASE_CRIT_RATE) + fromBuffs;
  return Math.min(Math.max(total, 0), MAX_CRIT_RATE);
}

/** What a crit is worth, as a percent of the plain value. Never less than 100. */
export function critDamage(args: { stats: CritStats; buffs?: BuffLike[] }) {
  const fromBuffs = (args.buffs ?? []).reduce((total, held) => total + (held.buff?.critDamageBonus ?? 0), 0);
  return Math.max((args.stats.critDamage ?? BASE_CRIT_DAMAGE) + fromBuffs, 100);
}

/** The roll itself. `roll` is injected so the unit tests are not at the mercy of chance. */
export function rollsCritical(args: { rate: number; roll?: number }) {
  const roll = args.roll ?? Math.random() * 100;
  return roll < args.rate;
}

/** Applies the multiplier to a value that has already been rolled as critical. */
export function applyCritical(value: number, critDamagePercent: number) {
  return Math.floor((value * critDamagePercent) / 100);
}

/**
 * The whole roll in one call: hands back the value to use and whether it was a
 * crit, so the caller can say so in the battle log.
 */
export function rollCritical(args: { value: number; stats: CritStats; buffs?: BuffLike[]; roll?: number }) {
  const critical = rollsCritical({ rate: critRate(args), roll: args.roll });
  if (!critical) return { value: Math.floor(args.value), critical: false };
  return { value: applyCritical(args.value, critDamage(args)), critical: true };
}
