/**
 * Pure guild boss maths — no database, no cache, no sockets.
 *
 * A boss row carries its easy-difficulty numbers; everything harder is those
 * numbers multiplied. Health climbs faster than the reward on purpose, so a
 * nightmare boss is a commitment for the whole guild rather than a shortcut for
 * one strong player.
 */

export const GUILD_BOSS_DIFFICULTIES = ['easy', 'normal', 'hard', 'nightmare'] as const;

export type GuildBossDifficulty = (typeof GUILD_BOSS_DIFFICULTIES)[number];

type Modifier = { health: number; attack: number; reward: number };

const MODIFIERS: Record<GuildBossDifficulty, Modifier> = {
  easy: { health: 1, attack: 1, reward: 1 },
  normal: { health: 3, attack: 1.6, reward: 2.5 },
  hard: { health: 9, attack: 2.6, reward: 6 },
  nightmare: { health: 25, attack: 4, reward: 14 },
};

export function isGuildBossDifficulty(value: string): value is GuildBossDifficulty {
  return (GUILD_BOSS_DIFFICULTIES as readonly string[]).includes(value);
}

type BossNumbers = { health: number; attack: number; taskPoints: number; tokens: number };

/** What the boss actually stands up with at the chosen difficulty. */
export function scaleBoss(boss: BossNumbers, difficulty: GuildBossDifficulty): BossNumbers {
  const modifier = MODIFIERS[difficulty];
  return {
    health: Math.floor(boss.health * modifier.health),
    attack: Math.floor(boss.attack * modifier.attack),
    taskPoints: Math.floor(boss.taskPoints * modifier.reward),
    tokens: Math.floor(boss.tokens * modifier.reward),
  };
}

/**
 * A party's damage is one score, split evenly between everyone who walked in.
 * The fight costs all of them an entry, so it pays all of them the same — and a
 * healer who never landed a hit banks as much as the one who did.
 *
 * Flooring would quietly lose damage off the pool, so the remainder is handed
 * out a point at a time.
 */
export function shareDamageEvenly(totalDamage: number, participants: string[]) {
  if (participants.length === 0 || totalDamage <= 0) return [];

  const emails = [...participants].sort();
  const each = Math.floor(totalDamage / emails.length);
  let remainder = totalDamage - each * emails.length;

  return emails.map((userEmail) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return { userEmail, damage: each + extra };
  });
}

/**
 * Identifies the group that fought together, so the ranking can show them
 * linked. The same people fighting again on another day land on the same key;
 * a solo fight has none.
 */
export function partyKeyFor(participants: string[]) {
  if (participants.length <= 1) return null;
  return [...participants].sort().join('|');
}

/**
 * Splits the token pool by damage dealt. Anyone who landed a hit takes at least
 * one token — a healer's share should never round away to nothing — and the
 * remainder from flooring goes to whoever hit hardest.
 */
export function splitTokensByDamage(pool: number, damages: { userEmail: string; damage: number }[]) {
  const contributors = damages.filter((entry) => entry.damage > 0);
  if (contributors.length === 0 || pool <= 0) return [];

  const total = contributors.reduce((sum, entry) => sum + entry.damage, 0);
  const shares = contributors.map((entry) => ({
    userEmail: entry.userEmail,
    damage: entry.damage,
    tokens: Math.max(1, Math.floor((entry.damage / total) * pool)),
  }));

  const handedOut = shares.reduce((sum, share) => sum + share.tokens, 0);
  const remainder = pool - handedOut;
  if (remainder > 0) {
    const top = shares.reduce((best, share) => (share.damage > best.damage ? share : best), shares[0]);
    top.tokens += remainder;
  }

  return shares.map(({ userEmail, tokens }) => ({ userEmail, tokens }));
}
