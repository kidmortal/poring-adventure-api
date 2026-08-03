/**
 * The daily board, as pure arithmetic — no database, no clock of its own.
 *
 * Which contracts a player sees is *derived* from their email and the day
 * rather than stored: the same pair always produces the same draw, so the board
 * survives a reload without a write and cannot be re-rolled by looking again.
 */

export type CommissionOption = {
  id: number;
  requiredLevel: number;
  professionId: number;
};

/** How many contracts a player is offered per day. */
export const DAILY_COMMISSION_SLOTS = 4;

/** The UTC calendar day, in the same shape the stamina refill uses. */
export function utcDayKey(date: Date) {
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
}

/**
 * A small deterministic hash. Nothing here is a secret — it only has to spread
 * evenly and give the same answer twice for the same input.
 */
function hash(seed: string) {
  let value = 2166136261;
  for (let index = 0; index < seed.length; index++) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

/**
 * The day's board for one player.
 *
 * Contracts are drawn from the ones their profession and level qualify for,
 * ordered by a per-contract hash of the seed, which is a stable shuffle: the
 * order changes every day and between players, and never within a day.
 */
export function pickDailyCommissions(args: {
  available: CommissionOption[];
  userEmail: string;
  professionId: number;
  level: number;
  day: string;
  slots?: number;
}): CommissionOption[] {
  const eligible = args.available.filter(
    (commission) => commission.professionId === args.professionId && commission.requiredLevel <= args.level,
  );

  return eligible
    .map((commission) => ({ commission, order: hash(`${args.userEmail}:${args.day}:${commission.id}`) }))
    .sort((a, b) => a.order - b.order)
    .slice(0, args.slots ?? DAILY_COMMISSION_SLOTS)
    .map(({ commission }) => commission);
}
