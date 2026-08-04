import { BattleInstance, MonsterWithDrops, UserWithStats } from './battle';

/**
 * The engine driven end to end, because the pieces these tests cover only meet
 * each other at the table: a party buff has to survive the turn it was cast on,
 * an area skill has to charge one mana cost across several damage steps, and a
 * barrier only means anything once a monster swings into it.
 */

const socket = { sendMessageToSocket: () => {}, sendErrorNotification: () => {} } as never;

function stats(overrides: Record<string, number> = {}) {
  return {
    level: 10,
    health: 200,
    maxHealth: 200,
    mana: 100,
    maxMana: 100,
    attack: 10,
    str: 10,
    agi: 1,
    int: 40,
    defense: 10,
    ...overrides,
  };
}

const AEGIS = {
  id: 9,
  name: 'Aegis',
  effect: 'barrier',
  duration: 4,
  image: 'aegis.webp',
  pose: 'enhanced',
  persist: false,
  maxStack: 1,
  attackBonus: 0,
  healthBonus: 0,
};

const SUNDERED = {
  id: 3,
  name: 'Sundered',
  effect: 'defense_down',
  duration: 3,
  image: 'sundered.webp',
  potency: 25,
  maxStack: 1,
};

function skill(over: {
  id: number;
  name: string;
  category: string;
  effect?: string;
  multiplier?: number;
  areaOfEffect?: boolean;
  manaCost?: number;
  buff?: unknown;
  debuff?: unknown;
}) {
  return {
    id: over.id,
    skillId: over.id,
    masteryLevel: 1,
    cooldown: 0,
    userEmail: 'x',
    equipped: true,
    skill: {
      id: over.id,
      name: over.name,
      image: `${over.name}.webp`,
      category: over.category,
      effect: over.effect ?? '',
      attribute: 'int',
      multiplier: over.multiplier ?? 2,
      manaCost: over.manaCost ?? 10,
      cooldown: 0,
      requiredLevel: 1,
      description: '',
      threatModifier: 1,
      classId: 1,
      buffId: null,
      debuffId: null,
      areaOfEffect: !!over.areaOfEffect,
      buff: over.buff,
      debuff: over.debuff,
    },
  };
}

function player(name: string, skills: unknown[]) {
  return {
    email: `${name}@test`,
    name,
    stats: stats(),
    buffs: [],
    learnedSkills: skills,
    isDead: false,
  } as unknown as UserWithStats;
}

function monster(name: string, overrides: Record<string, number> = {}) {
  return {
    id: 1,
    name,
    image: `${name}.webp`,
    level: 10,
    boss: false,
    attack: 40,
    health: 300,
    agi: 0,
    defense: 20,
    silver: 1,
    exp: 1,
    mapId: 1,
    drops: [],
    ...overrides,
  } as unknown as MonsterWithDrops;
}

function build(users: UserWithStats[], monsters: MonsterWithDrops[]) {
  const battle = new BattleInstance({
    socket,
    users,
    monsters,
    updateUsers: async () => {},
    removeBattle: async () => true,
  });
  const state = () => JSON.parse(JSON.stringify(battle.toJson()));

  /** Hands the turn to a named player, so a test can act out of speed order. */
  function giveTurn(name: string) {
    const index = state().attackerList.indexOf(name);
    (battle as unknown as { attackerTurn: number }).attackerTurn = index;
  }

  return { battle, state, giveTurn };
}

describe('BattleInstance', () => {
  describe('a pull of several monsters', () => {
    it('stands them all up with their own health and a slot each in the order', () => {
      const { state } = build([player('Mage', [])], [monster('Poring A'), monster('Poring B', { health: 50 })]);

      expect(state().monsters.map((m: { name: string }) => m.name)).toEqual(['Poring A', 'Poring B']);
      expect(state().monsters.map((m: { maxHealth: number }) => m.maxHealth)).toEqual([300, 50]);
      expect(state().attackerList).toHaveLength(3);
    });
  });

  describe('an area damage skill', () => {
    it('hits every monster standing, for one mana cost and one turn', () => {
      const flamestrike = skill({
        id: 1,
        name: 'Flamestrike',
        category: 'target_enemy',
        areaOfEffect: true,
        manaCost: 10,
        debuff: SUNDERED,
      });
      const { battle, state, giveTurn } = build(
        [player('Mage', [flamestrike])],
        [monster('Poring A'), monster('Poring B'), monster('Poring C')],
      );

      giveTurn('Mage');
      const turnBefore = state().attackerTurn;
      battle.processUserCast({ email: 'Mage@test', skillId: 1, targetName: undefined as unknown as string });

      const after = state();
      after.monsters.forEach((m: { health: number; debuffs: unknown[] }) => {
        expect(m.health).toBeLessThan(300);
        // The debuff the skill carries lands on every one of them too.
        expect(m.debuffs).toHaveLength(1);
      });
      // One cast, one mana cost — not one per monster.
      expect(after.users[0].stats.mana).toBe(90);
      expect(after.attackerTurn).not.toBe(turnBefore);
    });
  });

  describe('a party buff', () => {
    it('reaches everyone alive, each with their own copy of the pool', () => {
      const blessing = skill({
        id: 1,
        name: 'Blessing of Protection',
        category: 'buff_party',
        multiplier: 4,
        buff: AEGIS,
      });
      const priest = player('Priest', [blessing]);
      const knight = player('Knight', []);
      const { battle, state, giveTurn } = build([priest, knight], [monster('Poring')]);

      giveTurn('Priest');
      battle.processUserCast({ email: 'Priest@test', skillId: 1, targetName: undefined as unknown as string });

      const buffs = state().users.map((u: { buffs: { barrier: number }[] }) => u.buffs);
      expect(buffs).toHaveLength(2);
      // 4 x 40 int: sized off the caster, for the caster and the ally alike.
      buffs.forEach((list: { barrier: number }[]) => {
        expect(list).toHaveLength(1);
        expect(list[0].barrier).toBe(160);
      });
    });

    it('skips the dead, who have no use for it', () => {
      const blessing = skill({ id: 1, name: 'Aegis', category: 'buff_party', buff: AEGIS });
      const priest = player('Priest', [blessing]);
      const corpse = player('Knight', []);
      corpse.isDead = true;
      const { battle, state, giveTurn } = build([priest, corpse], [monster('Poring')]);

      giveTurn('Priest');
      battle.processUserCast({ email: 'Priest@test', skillId: 1, targetName: undefined as unknown as string });

      expect(state().users.find((u: { name: string }) => u.name === 'Knight').buffs).toHaveLength(0);
    });
  });

  describe('a barrier', () => {
    it('is spent before health, and disappears once it is empty', () => {
      const blessing = skill({ id: 1, name: 'Aegis', category: 'buff_party', multiplier: 4, buff: AEGIS });
      const priest = player('Priest', [blessing]);
      const { battle, state, giveTurn } = build([priest], [monster('Poring', { attack: 60, agi: 0 })]);

      giveTurn('Priest');
      battle.processUserCast({ email: 'Priest@test', skillId: 1, targetName: undefined as unknown as string });
      expect(state().users[0].stats.health).toBe(200);

      // Let the monster swing until the pool is gone. The turn is handed back
      // each time because nobody is playing the Priest between swings.
      for (let swing = 0; swing < 6; swing++) {
        giveTurn('Poring');
        battle.tickBattle();
      }

      const after = state();
      const barriers = after.users[0].buffs.filter((b: { buff: { effect: string } }) => b.buff.effect === 'barrier');
      expect(barriers).toHaveLength(0);
      // Health only starts falling once the barrier has been used up, so the
      // party got 160 points of hits for free.
      expect(after.users[0].stats.health).toBeLessThan(200);
      expect(after.log.some((entry: { message: string }) => entry.message.includes('absorbed'))).toBe(true);
    });
  });
});
