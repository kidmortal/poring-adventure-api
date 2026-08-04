/**
 * Pure dungeon maths and shapes — no database, no cache, no sockets.
 *
 * A dungeon is three bosses fought back to back on one entry a day. Everything
 * here is about the two rules that follow from that: who may walk in, and how a
 * boss row becomes something the battle engine can put at the table.
 */
import { DungeonDrop, DungeonMonster, Item } from '@prisma/client';

import { isNewDay } from 'src/feature/users/users.rules';
import { MonsterWithDrops } from 'src/feature/battle/battle';

export const RUN_STATUS = {
  active: 'active',
  cleared: 'cleared',
  failed: 'failed',
} as const;

export type RunStatus = (typeof RUN_STATUS)[keyof typeof RUN_STATUS];

/**
 * How much of their pools the party gets back between bosses.
 *
 * The gauntlet is meant to be fought on one health bar — that is what makes the
 * third boss the hard one rather than just the biggest. But a party that walks
 * out of the second fight with a corpse in it has no way to bring them back,
 * so the camp is the concession: everyone comes back, nobody comes back full.
 */
export const CAMP_RESTORE = 0.3;

export type DungeonMonsterWithDrops = DungeonMonster & {
  drops: (DungeonDrop & { item: Item })[];
};

/** Whether today's entry to this dungeon is still unspent. */
export function hasEntryToday(entry: { usedAt: Date } | null | undefined, now: Date) {
  return isNewDay(entry?.usedAt, now);
}

/**
 * A run that was opened on an earlier day. Entries come back at midnight UTC,
 * so a run left standing across the boundary would let a party carry a spent
 * day's progress into a fresh entry — two attempts for the price of one.
 */
export function isRunStale(run: { startedAt: Date }, now: Date) {
  return isNewDay(run.startedAt, now);
}

export type EntryBlocker = {
  email: string;
  name: string;
  reason: string;
};

/**
 * Who the party would be turned away for, worked out in one pass so the client
 * can name all of them at once rather than discovering them one attempt at a
 * time. The entry is spent by everybody, so one member out of entries stops the
 * whole party.
 */
export function entryBlockers(args: {
  participants: { email: string; name: string }[];
  entries: { userEmail: string; usedAt: Date }[];
  now: Date;
}): EntryBlocker[] {
  const entryByEmail = new Map(args.entries.map((entry) => [entry.userEmail, entry]));

  return args.participants
    .filter((participant) => !hasEntryToday(entryByEmail.get(participant.email), args.now))
    .map((participant) => ({
      email: participant.email,
      name: participant.name,
      reason: 'has already run this dungeon today',
    }));
}

/**
 * Dresses a dungeon boss up as the monster the battle engine expects.
 *
 * The id is negated and the map is zero for the same reason the guild boss does
 * it: nothing here is a row in Monster, so an id that collided with one would
 * have the client drawing the wrong sprite, and a real mapId would credit the
 * kill to whatever guild task happens to be running on that map.
 */
export function toBattleMonster(monster: DungeonMonsterWithDrops): MonsterWithDrops {
  return {
    id: -monster.id,
    name: monster.name,
    image: monster.image,
    level: monster.level,
    boss: true,
    attack: monster.attack,
    health: monster.health,
    agi: monster.agi,
    defense: monster.defense,
    silver: monster.silver,
    exp: monster.exp,
    mapId: 0,
    drops: monster.drops.map((drop) => ({
      id: drop.id,
      chance: drop.chance,
      minAmount: drop.minAmount,
      maxAmount: drop.maxAmount,
      monsterId: -monster.id,
      itemId: drop.itemId,
      item: drop.item,
    })),
  };
}

/** What each member is topped up to when the next boss is opened. */
export function campRestore(stats: { health: number; maxHealth: number; mana: number; maxMana: number }) {
  const health = Math.max(1, Math.floor(stats.maxHealth * CAMP_RESTORE));
  const mana = Math.max(0, Math.floor(stats.maxMana * CAMP_RESTORE));

  // Only ever a floor: a party that finished the last boss in better shape than
  // the camp would give them keeps what they had.
  return {
    health: Math.min(stats.maxHealth, Math.max(stats.health, health)),
    mana: Math.min(stats.maxMana, Math.max(stats.mana, mana)),
  };
}
