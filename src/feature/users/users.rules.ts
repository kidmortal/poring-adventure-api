/**
 * Pure user maths — no database, no cache, no sockets.
 * Anything here can be unit tested without a Nest module.
 */

export type StatChanges = {
  level?: number;
  health?: number;
  mana?: number;
  attack?: number;
  str?: number;
  int?: number;
  agi?: number;
};

/**
 * Health and mana never drop below 0, and never exceed their max when one is
 * known — rows written before maxHealth/maxMana existed simply have no ceiling.
 */
export function clampVital(args: { current: number; amount: number; max?: number }) {
  const raised = Math.max(args.current + args.amount, 0);
  return Number.isFinite(args.max) ? Math.min(raised, args.max) : raised;
}

/** Builds the prisma stats payload, defaulting every untouched stat to 0. */
export function statDelta(changes: StatChanges, direction: 'increment' | 'decrement') {
  return {
    level: { [direction]: changes.level ?? 0 },
    maxHealth: { [direction]: changes.health ?? 0 },
    maxMana: { [direction]: changes.mana ?? 0 },
    attack: { [direction]: changes.attack ?? 0 },
    str: { [direction]: changes.str ?? 0 },
    agi: { [direction]: changes.agi ?? 0 },
    int: { [direction]: changes.int ?? 0 },
  };
}
