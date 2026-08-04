import { MonsterWithDrops, UserWithStats } from './battle';

/**
 * The reduction curve's softening constant. Raising it makes every point of
 * defense worth less; it exists so that low-level gear is not worth more than
 * high-level gear simply because the numbers are smaller.
 */
const DEFENSE_SOFTENING = 50;

/** Defense scales against the attacker's level, so a tier of gear does not last forever. */
const DEFENSE_PER_ATTACKER_LEVEL = 10;

/**
 * The hard ceiling on mitigation. Set now, before the gear exists that could
 * break it — without it a future defense tier makes a tank simply immortal.
 */
const MAX_MITIGATION = 0.75;

/** The hard ceiling on dodging, for the same reason. */
const MAX_EVASION = 0.2;

/** How much agi is worth one percentage point of evasion. */
const AGI_PER_EVASION_POINT = 200;

/** Every two points of strength are worth one point of defense. */
const STR_PER_DEFENSE = 2;

function generateBattleAttackOrder(users: UserWithStats[], monsters: MonsterWithDrops[]) {
  return [
    ...users.map((user) => ({ name: user.name, speed: user.stats.agi ?? 0 })),
    ...monsters.map((monster) => ({ name: monster.name, speed: monster.agi || monster.level })),
  ]
    .sort((a, b) => b.speed - a.speed)
    .map((entry) => entry.name);
}

/**
 * How much of a hit actually lands. Diminishing rather than subtractive, so
 * defense never reaches zero damage and there is no negative-damage edge case
 * to guard elsewhere — a hit always costs at least 1 health.
 */
function mitigate(args: { raw: number; defense: number; attackerLevel: number }) {
  const { raw, defense, attackerLevel } = args;
  if (defense <= 0) return Math.max(1, Math.floor(raw));

  const softener = DEFENSE_SOFTENING + DEFENSE_PER_ATTACKER_LEVEL * Math.max(attackerLevel, 1);
  const reduction = Math.min(defense / (defense + softener), MAX_MITIGATION);
  return Math.max(1, Math.floor(raw * (1 - reduction)));
}

/**
 * A player's defense at the table: the flat stat from class levels and gear,
 * plus what their strength is worth. Strength is otherwise inert on everyone
 * but a Rune Knight, and it is the Knight's largest stat.
 */
function effectiveDefense(args: { defense?: number; str?: number }) {
  return (args.defense ?? 0) + Math.floor((args.str ?? 0) / STR_PER_DEFENSE);
}

/** The chance to dodge outright, from agility, capped so speed cannot mean immunity. */
function evasionChance(agi: number) {
  return Math.min(Math.max(agi, 0) / AGI_PER_EVASION_POINT, MAX_EVASION);
}

/**
 * A monster that has been left standing too long hits harder with every swing,
 * so a fight it cannot win outright still ends. `stacks` is how many times it
 * has already attacked while enraged — the first enraged hit is the plain one.
 */
function enragedDamage(baseDamage: number, stacks: number, multiplier: number) {
  if (stacks <= 0) return baseDamage;
  return Math.floor(baseDamage * Math.pow(multiplier, stacks));
}

export const BattleUtils = {
  generateBattleAttackOrder,
  enragedDamage,
  mitigate,
  effectiveDefense,
  evasionChance,
  MAX_MITIGATION,
  MAX_EVASION,
};
