import { BattleInstance, MonsterWithDrops, UserWithStats } from './battle';
import { buffedAttack } from './buffs';
import { debuffedAttack } from './debuffs';

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
  critRateBonus: 0,
  critDamageBonus: 0,
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

const POISON = {
  id: 7,
  name: 'Venom',
  effect: 'poison',
  duration: 3,
  image: 'venom.webp',
  potency: 10,
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

  describe('what a fight starts with', () => {
    it('keeps the meal and drops the blessing the last fight put up', () => {
      const mage = player('Mage', []);
      const meal = { ...AEGIS, id: 20, name: 'Well Fed', effect: 'well_fed', persist: true };
      const blessing = { ...AEGIS, id: 21, name: 'Aegis', persist: false };
      mage.buffs = [
        { id: 1, userEmail: mage.email, buffId: 20, duration: 3, buff: meal },
        { id: 2, userEmail: mage.email, buffId: 21, duration: 3, buff: blessing },
      ] as unknown as typeof mage.buffs;

      const { state } = build([mage], [monster('Poring')]);

      // Food is a decision made before the fight and it outlives one; a skill's
      // buff belongs to the fight it was cast in.
      expect(state().users[0].buffs).toHaveLength(1);
      expect(state().users[0].buffs[0].buff.name).toBe('Well Fed');
    });
  });

  describe('a buff arriving twice', () => {
    it('refreshes rather than stacking a second copy on the same player', async () => {
      const { battle, state } = build([player('Mage', [])], [monster('Poring')]);
      const powerUp = { ...AEGIS, id: 4, name: 'Power up', effect: 'power_up', duration: 5 };

      await battle.runDebugAction({ action: 'buff_allies', by: 'an admin', buff: powerUp });
      await battle.runDebugAction({ action: 'buff_allies', by: 'an admin', buff: powerUp });
      await battle.runDebugAction({ action: 'buff_allies', by: 'an admin', buff: powerUp });

      // Three casts, one icon — the screen that started this was three of them.
      expect(state().users[0].buffs).toHaveLength(1);
      expect(state().users[0].buffs[0].duration).toBe(5);
    });

    it('keeps the longer duration when a shorter one lands on top', async () => {
      const { battle, state } = build([player('Mage', [])], [monster('Poring')]);
      const long = { ...AEGIS, id: 4, name: 'Power up', effect: 'power_up', duration: 8 };
      const short = { ...long, duration: 2 };

      await battle.runDebugAction({ action: 'buff_allies', by: 'an admin', buff: long });
      await battle.runDebugAction({ action: 'buff_allies', by: 'an admin', buff: short });

      expect(state().users[0].buffs[0].duration).toBe(8);
    });
  });

  describe("the two sides carrying each other's effects", () => {
    it('puts a buff on a monster, and lets it hit harder for it', async () => {
      const { battle, state } = build([player('Mage', [])], [monster('Poring', { attack: 100 })]);
      const rage = { ...AEGIS, id: 5, name: 'Rage', effect: 'power_up', attackBonus: 50, duration: 3 };

      await battle.runDebugAction({ action: 'buff_monsters', by: 'an admin', buff: rage });

      expect(state().monsters[0].buffs).toHaveLength(1);
      expect(buffedAttack(state().monsters[0], 100)).toBe(150);
    });

    it('puts a debuff on the party, and weakens what they swing for', async () => {
      const { battle, state } = build([player('Mage', [])], [monster('Poring')]);
      const weakened = { ...POISON, id: 8, name: 'Weakened', effect: 'attack_down', potency: 40 };

      await battle.runDebugAction({ action: 'debuff_allies', by: 'an admin', debuff: weakened });

      expect(state().users[0].debuffs).toHaveLength(1);
      expect(debuffedAttack(state().users[0], 100)).toBe(60);
    });

    it('burns a poisoned player at the top of their own turn', async () => {
      const { battle, state, giveTurn } = build([player('Mage', []), player('Priest', [])], [monster('Poring')]);

      await battle.runDebugAction({ action: 'debuff_allies', by: 'an admin', debuff: POISON });
      const before = state().users[0].stats.health;

      // Hand the turn round the order until it comes back to the Mage.
      giveTurn('Mage');
      await battle.runDebugAction({ action: 'next_turn', by: 'an admin' });
      await battle.runDebugAction({ action: 'next_turn', by: 'an admin' });
      await battle.runDebugAction({ action: 'next_turn', by: 'an admin' });

      // 10% of a 200 pool, once their slot came round again.
      expect(state().users[0].stats.health).toBeLessThan(before);
    });
  });

  describe("the Priest's support turns", () => {
    it('cleanses the whole party, and leaves nothing on anybody', async () => {
      const dispel = skill({
        id: 1,
        name: 'Dispel Magic',
        category: 'target_ally',
        effect: 'cleanse',
        areaOfEffect: true,
      });
      const { battle, state, giveTurn } = build(
        [player('Priest', [dispel]), player('Knight', [])],
        [monster('Poring')],
      );

      await battle.runDebugAction({ action: 'debuff_allies', by: 'an admin', debuff: POISON });
      expect(state().users.every((u: { debuffs: unknown[] }) => u.debuffs.length === 1)).toBe(true);

      giveTurn('Priest');
      await battle.processUserCast({ email: 'Priest@test', skillId: 1, targetName: undefined as unknown as string });

      // One turn, everybody's curses — which is what makes it worth a turn at all.
      expect(state().users.every((u: { debuffs: unknown[] }) => u.debuffs.length === 0)).toBe(true);
      expect(state().users[0].stats.mana).toBe(90);
      expect(state().log.some((entry: { message: string }) => entry.message.includes('cleansed'))).toBe(true);
    });

    it('curses every enemy standing without dealing a point of damage', async () => {
      const scream = skill({
        id: 1,
        name: 'Psychic Scream',
        category: 'debuff_enemy',
        areaOfEffect: true,
        debuff: SUNDERED,
      });
      const { battle, state, giveTurn } = build(
        [player('Priest', [scream])],
        [monster('Poring A'), monster('Poring B')],
      );

      giveTurn('Priest');
      const turnBefore = state().attackerTurn;
      await battle.processUserCast({ email: 'Priest@test', skillId: 1, targetName: undefined as unknown as string });

      const after = state();
      after.monsters.forEach((m: { health: number; debuffs: unknown[] }) => {
        // The curse is the whole skill: nothing else lands, so nothing is taken
        // off the health bar and no threat is generated by a number never dealt.
        expect(m.health).toBe(300);
        expect(m.debuffs).toHaveLength(1);
      });
      expect(after.users[0].aggro).toBe(0);
      expect(after.users[0].stats.mana).toBe(90);
      expect(after.attackerTurn).not.toBe(turnBefore);
    });

    it('lights a boss for the caster’s number, not for a share of its health', async () => {
      const CONDEMNED = { ...POISON, id: 11, name: 'Condemned', effect: 'burn', potency: 0, duration: 4 };
      const holyFire = skill({
        id: 1,
        name: 'Holy Fire',
        category: 'debuff_enemy',
        multiplier: 1,
        debuff: CONDEMNED,
      });
      // The fight the percentage burn used to cheese: an enormous pool where a
      // share of it per turn was worth more than the whole party's damage.
      const { battle, state, giveTurn } = build(
        [player('Priest', [holyFire])],
        [monster('Boss', { health: 50000, attack: 1 })],
      );

      giveTurn('Priest');
      await battle.processUserCast({ email: 'Priest@test', skillId: 1, targetName: undefined as unknown as string });
      expect(state().monsters[0].debuffs[0].amount).toBe(40);

      // Paid at the top of the boss's own turn, and worth the Priest's 40 int
      // whatever it is stuck on.
      giveTurn('Boss');
      await battle.tickBattle();
      expect(state().monsters[0].health).toBe(49960);
    });

    it('renews the party, paying each of them at the top of their own turn', async () => {
      const RENEWED = { ...AEGIS, id: 30, name: 'Renewed', effect: 'regeneration', duration: 3 };
      const renew = skill({ id: 1, name: 'Regeneration', category: 'buff_party', multiplier: 1.2, buff: RENEWED });
      const { battle, state, giveTurn } = build([player('Priest', [renew]), player('Knight', [])], [monster('Poring')]);

      await battle.runDebugAction({ action: 'hurt_allies', by: 'an admin', amount: 100 });
      giveTurn('Priest');
      await battle.processUserCast({ email: 'Priest@test', skillId: 1, targetName: undefined as unknown as string });

      // 1.2 x 40 int, locked in from the caster the way a barrier's pool is.
      const buffs = state().users.map((u: { buffs: { regen: number }[] }) => u.buffs);
      buffs.forEach((list: { regen: number }[]) => expect(list[0].regen).toBe(48));

      // Casting handed the turn on, and whoever holds it now has already been paid.
      const knight = () => state().users.find((u: { name: string }) => u.name === 'Knight');
      expect(knight().stats.health).toBe(148);
      // The Priest is paid when their own slot comes round, not in lockstep.
      expect(state().users[0].stats.health).toBe(100);

      await battle.runDebugAction({ action: 'next_turn', by: 'an admin' });
      await battle.runDebugAction({ action: 'next_turn', by: 'an admin' });
      expect(state().users[0].stats.health).toBe(148);
    });

    it('never regenerates past the bar it is filling', async () => {
      const RENEWED = { ...AEGIS, id: 30, name: 'Renewed', effect: 'regeneration', duration: 3 };
      const renew = skill({ id: 1, name: 'Regeneration', category: 'buff_party', multiplier: 1.2, buff: RENEWED });
      const { battle, state, giveTurn } = build([player('Priest', [renew]), player('Knight', [])], [monster('Poring')]);

      giveTurn('Priest');
      await battle.processUserCast({ email: 'Priest@test', skillId: 1, targetName: undefined as unknown as string });

      const knight = state().users.find((u: { name: string }) => u.name === 'Knight');
      expect(knight.stats.health).toBe(200);
      // And it says nothing it did not do — a heal into a full bar is silent.
      expect(state().log.some((entry: { message: string }) => entry.message.includes('restored'))).toBe(false);
    });
  });

  describe('an admin killing the fight', () => {
    it('deals the remaining health rather than declaring it', async () => {
      // What consumeDamage holds is what a guild boss banks and pays out on, so
      // a kill that skips the tally leaves the pool full and nobody rewarded.
      const { battle } = build([player('Mage', [])], [monster('Poring A'), monster('Poring B', { health: 50 })]);

      await battle.forceKillMonsters({ by: 'an admin', credit: 'Mage@test' });

      expect(battle.consumeDamage()).toEqual([{ userEmail: 'Mage@test', damage: 350 }]);
      expect(battle.isMonsterAlive).toBe(false);
      expect(battle.battleFinished).toBe(true);
    });

    it('credits somebody in the fight when the admin is not in it', async () => {
      const { battle } = build([player('Mage', [])], [monster('Poring')]);

      await battle.forceKillMonsters({ by: 'an admin', credit: 'someoneelse@test' });

      expect(battle.consumeDamage()).toEqual([{ userEmail: 'Mage@test', damage: 300 }]);
    });

    it('leaves the turn where it was, whatever it did', async () => {
      // The whole point of the debug actions: a fight is driven by turns, so a
      // tool that spent one would change the thing it is being used to inspect.
      const { battle, state } = build([player('Mage', []), player('Priest', [])], [monster('Poring')]);
      const before = state().attackerTurn;

      for (const action of ['heal_allies', 'restore_mana', 'drain_mana', 'clear_buffs', 'enrage'] as const) {
        await battle.runDebugAction({ action, by: 'an admin' });
        expect(state().attackerTurn).toBe(before);
      }
    });

    it('passes the turn only when asked to', async () => {
      const { battle, state } = build([player('Mage', []), player('Priest', [])], [monster('Poring')]);
      const before = state().attackerTurn;

      await battle.runDebugAction({ action: 'next_turn', by: 'an admin' });
      expect(state().attackerTurn).not.toBe(before);
    });

    it('revives the party it heals, so a wiped fight can carry on', async () => {
      const { battle, state } = build([player('Mage', [])], [monster('Poring')]);
      await battle.runDebugAction({ action: 'hurt_allies', by: 'an admin', amount: 9999 });
      expect(state().users[0].isDead).toBe(true);

      await battle.runDebugAction({ action: 'heal_allies', by: 'an admin' });
      expect(state().users[0].isDead).toBe(false);
      expect(state().users[0].stats.health).toBe(state().users[0].stats.maxHealth);
    });

    it('banks what it takes off a monster, the way a real hit does', async () => {
      const { battle } = build([player('Mage', [])], [monster('Poring')]);
      await battle.runDebugAction({ action: 'hurt_monsters', by: 'Mage@test', amount: 120 });

      expect(battle.consumeDamage()).toEqual([{ userEmail: 'Mage@test', damage: 120 }]);
    });

    it('refuses a fight that is already settled, so nothing banks twice', async () => {
      const { battle } = build([player('Mage', [])], [monster('Poring')]);

      await battle.forceKillMonsters({ by: 'an admin', credit: 'Mage@test' });
      battle.consumeDamage();

      expect(await battle.forceKillMonsters({ by: 'an admin', credit: 'Mage@test' })).toBe(false);
      expect(battle.consumeDamage()).toEqual([]);
    });
  });
});
