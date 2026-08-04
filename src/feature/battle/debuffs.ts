import { Debuff } from '@prisma/client';

import { MonsterInBattle } from './battle';

/**
 * What a skill can leave on a monster.
 *
 * This is the enemy-side counterpart of `effects.ts`. The difference in shape is
 * deliberate: a buff hooks the damage step of the player wearing it, while a
 * debuff is read by the engine at three fixed points — when the monster is hit,
 * when it swings, and when its turn comes round. There is nothing to dispatch
 * per-hit, so these are plain queries over the list rather than an effect map.
 */
export enum DebuffEffect {
  /** Armour shredded: the monster mitigates less of what the party lands. */
  DefenseDown = 'defense_down',
  /** The monster swings for less. */
  AttackDown = 'attack_down',
  /** Burns a share of the monster's starting health at the top of its turn. */
  Poison = 'poison',
  /** The monster loses its turn outright. */
  Stun = 'stun',
}

/** A debuff as it sits on a monster: the template, plus what is left of it. */
export type BattleDebuff = {
  name: string;
  effect: string;
  image: string;
  potency: number;
  /** Turns of the monster's own turns still to run. */
  duration: number;
};

/** No single debuff, and no pile of them, may take more than this off a stat. */
const MAX_STAT_REDUCTION = 0.7;

/** Nor may poison burn more than this share of a monster per turn. */
const MAX_POISON_PER_TURN = 0.25;

export function toBattleDebuff(debuff: Debuff): BattleDebuff {
  return {
    name: debuff.name,
    effect: debuff.effect,
    image: debuff.image,
    potency: debuff.potency,
    duration: debuff.duration,
  };
}

/**
 * Puts a debuff on a monster, refreshing rather than stacking once the debuff's
 * own `maxStack` is reached — a party of four Assassins re-applying the same
 * poison every turn should not multiply it four times over.
 */
export function applyDebuff(args: { monster: MonsterInBattle; debuff: Debuff }) {
  const { monster, debuff } = args;
  const existing = monster.debuffs.filter((d) => d.name === debuff.name);

  if (existing.length >= Math.max(debuff.maxStack, 1)) {
    existing.forEach((d) => (d.duration = debuff.duration));
    return false;
  }

  monster.debuffs.push(toBattleDebuff(debuff));
  return true;
}

function totalPotency(monster: MonsterInBattle, effect: DebuffEffect) {
  return monster.debuffs
    .filter((debuff) => debuff.effect === effect)
    .reduce((total, debuff) => total + debuff.potency, 0);
}

/** A percentage cut, floored so no debuff can turn a stat negative. */
function reduced(value: number, percent: number) {
  if (percent <= 0) return value;
  return Math.floor(value * (1 - Math.min(percent, MAX_STAT_REDUCTION * 100) / 100));
}

/** The defense the monster actually mitigates with, once its armour is shredded. */
export function debuffedDefense(monster: MonsterInBattle) {
  return reduced(monster.defense, totalPotency(monster, DebuffEffect.DefenseDown));
}

/** The damage the monster actually swings for, once it has been weakened. */
export function debuffedAttack(monster: MonsterInBattle, attack: number) {
  return Math.max(1, reduced(attack, totalPotency(monster, DebuffEffect.AttackDown)));
}

export function isStunned(monster: MonsterInBattle) {
  return monster.debuffs.some((debuff) => debuff.effect === DebuffEffect.Stun && debuff.duration > 0);
}

/**
 * What poison costs the monster this turn: a share of the health it started the
 * fight with, so a burn tuned against a map monster does not become the entire
 * fight when the same skill is pointed at a guild boss.
 */
export function poisonDamage(monster: MonsterInBattle) {
  const percent = Math.min(totalPotency(monster, DebuffEffect.Poison), MAX_POISON_PER_TURN * 100);
  if (percent <= 0) return 0;
  return Math.max(1, Math.floor((monster.maxHealth * percent) / 100));
}

/**
 * Ticks a monster's debuffs down by one of its own turns and drops what has run
 * out. Called once when the monster's slot in the order comes up, so a debuff
 * lasting two turns lasts two of the monster's turns whatever the party size.
 */
export function tickDebuffs(monster: MonsterInBattle) {
  monster.debuffs.forEach((debuff) => (debuff.duration -= 1));
  const expired = monster.debuffs.filter((debuff) => debuff.duration < 1);
  monster.debuffs = monster.debuffs.filter((debuff) => debuff.duration >= 1);
  return expired;
}
