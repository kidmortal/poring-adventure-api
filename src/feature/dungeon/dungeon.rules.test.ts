import { campRestore, entryBlockers, hasEntryToday, isRunStale, toBattleMonster } from './dungeon.rules';
import { DungeonMonsterWithDrops } from './dungeon.rules';

const NOW = new Date('2026-08-04T10:00:00Z');
const YESTERDAY = new Date('2026-08-03T23:59:00Z');
const EARLIER_TODAY = new Date('2026-08-04T00:01:00Z');

describe('hasEntryToday', () => {
  it('gives an entry to someone who has never been in', () => {
    expect(hasEntryToday(undefined, NOW)).toBe(true);
  });

  it('gives the entry back once the UTC day rolls over', () => {
    expect(hasEntryToday({ usedAt: YESTERDAY }, NOW)).toBe(true);
  });

  it('keeps it spent for the rest of the same day', () => {
    expect(hasEntryToday({ usedAt: EARLIER_TODAY }, NOW)).toBe(false);
  });
});

describe('isRunStale', () => {
  it('leaves a run opened today alone', () => {
    expect(isRunStale({ startedAt: EARLIER_TODAY }, NOW)).toBe(false);
  });

  it('marks one that survived midnight', () => {
    expect(isRunStale({ startedAt: YESTERDAY }, NOW)).toBe(true);
  });
});

describe('entryBlockers', () => {
  const participants = [
    { email: 'a@a.com', name: 'Ana' },
    { email: 'b@b.com', name: 'Bo' },
  ];

  it('lets a party through when nobody has been in today', () => {
    const blockers = entryBlockers({
      participants,
      entries: [{ userEmail: 'a@a.com', usedAt: YESTERDAY }],
      now: NOW,
    });
    expect(blockers).toEqual([]);
  });

  it('names everyone who is out of entries, not just the first', () => {
    const blockers = entryBlockers({
      participants,
      entries: [
        { userEmail: 'a@a.com', usedAt: EARLIER_TODAY },
        { userEmail: 'b@b.com', usedAt: EARLIER_TODAY },
      ],
      now: NOW,
    });

    expect(blockers.map((blocker) => blocker.name)).toEqual(['Ana', 'Bo']);
  });

  it('blocks the party for one member being spent', () => {
    const blockers = entryBlockers({
      participants,
      entries: [{ userEmail: 'b@b.com', usedAt: EARLIER_TODAY }],
      now: NOW,
    });

    expect(blockers).toHaveLength(1);
    expect(blockers[0].email).toBe('b@b.com');
  });
});

describe('campRestore', () => {
  it('brings someone who fell back up to the camp share', () => {
    expect(campRestore({ health: 0, maxHealth: 1000, mana: 0, maxMana: 200 })).toEqual({
      health: 300,
      mana: 60,
    });
  });

  it('never takes anything off a party that came through healthy', () => {
    expect(campRestore({ health: 900, maxHealth: 1000, mana: 150, maxMana: 200 })).toEqual({
      health: 900,
      mana: 150,
    });
  });

  it('leaves at least a point of health on a tiny pool', () => {
    expect(campRestore({ health: 0, maxHealth: 2, mana: 0, maxMana: 0 }).health).toBe(1);
  });
});

describe('toBattleMonster', () => {
  const boss = {
    id: 7,
    dungeonId: 1,
    stage: 3,
    name: 'Baphomet',
    image: 'baphomet.gif',
    level: 56,
    attack: 100,
    health: 20000,
    agi: 40,
    defense: 30,
    silver: 4000,
    exp: 3300,
    drops: [
      {
        id: 12,
        monsterId: 7,
        itemId: 44,
        chance: 100,
        minAmount: 1,
        maxAmount: 2,
        item: { id: 44, name: 'Arcane Staff' } as any,
      },
    ],
  } as DungeonMonsterWithDrops;

  it('keeps a dungeon boss out of the Monster id space', () => {
    const monster = toBattleMonster(boss);

    expect(monster.id).toBe(-7);
    expect(monster.drops[0].monsterId).toBe(-7);
  });

  it('belongs to no map, so the kill credits no guild task', () => {
    expect(toBattleMonster(boss).mapId).toBe(0);
  });

  it('always fights as a boss, whatever stage it is', () => {
    expect(toBattleMonster(boss).boss).toBe(true);
  });

  it('carries its own numbers and loot table through', () => {
    const monster = toBattleMonster(boss);

    expect(monster).toMatchObject({ name: 'Baphomet', health: 20000, attack: 100, exp: 3300 });
    expect(monster.drops).toHaveLength(1);
    expect(monster.drops[0]).toMatchObject({ itemId: 44, chance: 100, maxAmount: 2 });
  });
});
