import { Debuff } from '@prisma/client';

/**
 * What can be stuck on a combatant — monster or player alike.
 *
 * This is the counterpart of `effects.ts`. The difference in shape is
 * deliberate: a buff hooks the damage step of whoever wears it, while a debuff
 * is read by the engine at three fixed points — when its carrier is hit, when
 * it swings, and when its turn comes round. There is nothing to dispatch
 * per-hit, so these are plain queries over the list rather than an effect map.
 *
 * Nothing here knows what a monster is. A carrier is anything with a list of
 * debuffs and the one number the query needs, which is what lets the same
 * poison burn a player and a boss without a second implementation.
 */
export enum DebuffEffect {
  /** Armour shredded: the monster mitigates less of what the party lands. */
  DefenseDown = 'defense_down',
  /** The monster swings for less. */
  AttackDown = 'attack_down',
  /** Burns a share of the monster's starting health at the top of its turn. */
  Poison = 'poison',
  /**
   * The same tick, paid as a flat number instead of a share.
   *
   * This is the one a caster can point at anything: `poison` is worth more the
   * bigger its carrier, which makes a percentage tuned against a map monster
   * into a free quarter of a boss, while a burn is worth whatever the caster's
   * own stats made it worth when it landed and no more.
   */
  Burn = 'burn',
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
  /**
   * What a burn costs its carrier each turn. Locked in from whoever applied it,
   * the way a barrier's pool is, because it is the only number here that does
   * not come off the row — everything else is a percentage of the carrier.
   */
  amount?: number;
};

/** No single debuff, and no pile of them, may take more than this off a stat. */
const MAX_STAT_REDUCTION = 0.7;

/** Nor may poison burn more than this share of a monster per turn. */
const MAX_POISON_PER_TURN = 0.25;

export function toBattleDebuff(debuff: Debuff, amount?: number): BattleDebuff {
  return {
    name: debuff.name,
    effect: debuff.effect,
    image: debuff.image,
    potency: debuff.potency,
    duration: debuff.duration,
    amount,
  };
}

/** Anything that can carry debuffs: a monster, or a player at the table. */
export type DebuffCarrier = { debuffs: BattleDebuff[] };

/**
 * Puts a debuff on a carrier — one copy, and re-applying refreshes it.
 *
 * A second copy of the same name is never added. Two Assassins poisoning the
 * same monster, or one of them doing it every turn, would otherwise pile up
 * duplicate icons and multiply a potency that was tuned to be applied once. The
 * refresh takes the longer of what is left and what is being applied, so a
 * fresh cast cannot cut short a longer one already running — and the larger of
 * the two burns, so the stronger caster's number is the one that stands.
 */
export function applyDebuff(args: { target: DebuffCarrier; debuff: Debuff; amount?: number }) {
  const { target, debuff } = args;
  const existing = target.debuffs.find((d) => d.name === debuff.name);

  if (existing) {
    existing.duration = Math.max(existing.duration, debuff.duration);
    existing.amount = Math.max(existing.amount ?? 0, args.amount ?? 0) || undefined;
    return false;
  }

  target.debuffs.push(toBattleDebuff(debuff, args.amount));
  return true;
}

/**
 * Strips everything off a carrier and hands back what was lifted, so the caller
 * can say whose curse it broke.
 *
 * Deliberately unconditional: a cleanse that picked and chose which debuff to
 * lift would need the party to read the icons before casting, and a support
 * turn is already expensive enough. What it costs is that it is worth nothing
 * against a clean party — which is the decision the Priest is making.
 */
export function clearDebuffs(carrier: DebuffCarrier) {
  const lifted = carrier.debuffs;
  carrier.debuffs = [];
  return lifted;
}

function totalPotency(carrier: DebuffCarrier, effect: DebuffEffect) {
  return carrier.debuffs
    .filter((debuff) => debuff.effect === effect)
    .reduce((total, debuff) => total + debuff.potency, 0);
}

/** A percentage cut, floored so no debuff can turn a stat negative. */
function reduced(value: number, percent: number) {
  if (percent <= 0) return value;
  return Math.floor(value * (1 - Math.min(percent, MAX_STAT_REDUCTION * 100) / 100));
}

/** The defense actually mitigated with, once the armour is shredded. */
export function debuffedDefense(carrier: DebuffCarrier, defense: number) {
  return reduced(defense, totalPotency(carrier, DebuffEffect.DefenseDown));
}

/** The damage actually swung for, once weakened. */
export function debuffedAttack(carrier: DebuffCarrier, attack: number) {
  return Math.max(1, reduced(attack, totalPotency(carrier, DebuffEffect.AttackDown)));
}

export function isStunned(carrier: DebuffCarrier) {
  return carrier.debuffs.some((debuff) => debuff.effect === DebuffEffect.Stun && debuff.duration > 0);
}

/**
 * What poison costs this turn: a share of the health its carrier started with,
 * so a burn tuned against a map monster does not become the entire fight when
 * the same skill is pointed at a guild boss — or at a player.
 */
export function poisonDamage(args: { carrier: DebuffCarrier; maxHealth: number }) {
  const percent = Math.min(totalPotency(args.carrier, DebuffEffect.Poison), MAX_POISON_PER_TURN * 100);
  if (percent <= 0) return 0;
  return Math.max(1, Math.floor((args.maxHealth * percent) / 100));
}

/**
 * What the burns on a carrier cost it this turn: the flat amounts they landed
 * with, added up.
 *
 * Nothing here reads the carrier at all, which is the entire point. A poison
 * tuned to hurt a map monster is a quarter of a boss for the same cast; a burn
 * is the caster's number wherever it is pointed, so a party cannot buy its way
 * through something enormous by stacking ticks on it.
 */
export function burnDamage(carrier: DebuffCarrier) {
  return carrier.debuffs
    .filter((debuff) => debuff.effect === DebuffEffect.Burn)
    .reduce((total, debuff) => total + Math.max(debuff.amount ?? 0, 0), 0);
}

/**
 * Ticks debuffs down by one of the carrier's own turns and drops what has run
 * out. Called once when its slot in the order comes up, so a debuff lasting two
 * turns lasts two of *its* turns whatever the party size.
 */
export function tickDebuffs(carrier: DebuffCarrier) {
  carrier.debuffs.forEach((debuff) => (debuff.duration -= 1));
  const expired = carrier.debuffs.filter((debuff) => debuff.duration < 1);
  carrier.debuffs = carrier.debuffs.filter((debuff) => debuff.duration >= 1);
  return expired;
}
