/**
 * Pure guild maths — no database, no cache, no sockets.
 */

/** Prisma level payload that moves the guild to `correctLevel`, or nothing when it is already there. */
export function levelChange(args: { currentLevel: number; correctLevel: number }) {
  const diff = args.correctLevel - args.currentLevel;
  if (diff === 0) return {};
  return { level: diff > 0 ? { increment: diff } : { decrement: -diff } };
}
