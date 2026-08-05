/**
 * Pure guild maths — no database, no cache, no sockets.
 */

/** Prisma level payload that moves the guild to `correctLevel`, or nothing when it is already there. */
export function levelChange(args: { currentLevel: number; correctLevel: number }) {
  const diff = args.correctLevel - args.currentLevel;
  if (diff === 0) return {};
  return { level: diff > 0 ? { increment: diff } : { decrement: -diff } };
}

/** Soulshards to open the blessing shrine at all. */
export const BLESSING_UNLOCK_COST = 100;

/** What the first level of any blessing costs. */
export const BLESSING_BASE_COST = 100;

/** Each level is this much dearer than the one before it. */
export const BLESSING_COST_GROWTH = 1.35;

/** No blessing goes past this. */
export const MAX_BLESSING_LEVEL = 20;

/**
 * A blessing column stores the total stat granted, not a level — the level is
 * that total divided by the stat's step. Storing the total is what lets the
 * bonus be handed to members as it is bought, without a second column to keep
 * in step with it.
 */
export function blessingLevel(args: { current: number; factor: number }) {
  if (args.factor <= 0) return 0;
  return Math.floor(args.current / args.factor);
}

/**
 * What the next level costs, given how many are already bought.
 *
 * A flat 100 meant a guild's twentieth upgrade was as cheap as its first, so
 * shards stopped being a decision the moment the tokens came in at all — the
 * only question was which stat to dump them into. Compounding a third again
 * per level makes the twentieth cost some three hundred times the first, which
 * turns a mature guild's shard income into a real choice: spread the levels
 * across the blessings the members actually use, or spend a season pushing one
 * of them alone.
 */
export function blessingUpgradeCost(args: { level: number }) {
  const level = Math.max(args.level, 0);
  return Math.round(BLESSING_BASE_COST * BLESSING_COST_GROWTH ** level);
}

/** Whether there is another level left to buy. */
export function canUpgradeBlessing(args: { level: number }) {
  return args.level < MAX_BLESSING_LEVEL;
}
