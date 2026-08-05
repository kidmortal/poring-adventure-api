import { Debuff } from '@prisma/client';

import { MonsterInBattle } from './battle';
import { applyDebuff, debuffedAttack, debuffedDefense, isStunned, poisonDamage, tickDebuffs } from './debuffs';

function monster(overrides: Partial<MonsterInBattle> = {}) {
  return {
    id: 1,
    name: 'Poring',
    image: '',
    level: 10,
    boss: false,
    attack: 100,
    health: 500,
    maxHealth: 500,
    agi: 0,
    defense: 100,
    silver: 1,
    exp: 1,
    mapId: 1,
    drops: [],
    debuffs: [],
    ...overrides,
  } as MonsterInBattle;
}

function debuff(overrides: Partial<Debuff> = {}): Debuff {
  return {
    id: 1,
    name: 'Sundered',
    effect: 'defense_down',
    duration: 3,
    image: 'sunder.webp',
    potency: 25,
    maxStack: 1,
    ...overrides,
  };
}

describe('debuffs', () => {
  describe('applyDebuff', () => {
    it('sticks the debuff on the monster', () => {
      const target = monster();
      expect(applyDebuff({ target: target, debuff: debuff() })).toBe(true);
      expect(target.debuffs).toHaveLength(1);
      expect(target.debuffs[0]).toMatchObject({ name: 'Sundered', image: 'sunder.webp', duration: 3 });
    });

    it('refreshes rather than stacking', () => {
      const target = monster();
      applyDebuff({ target: target, debuff: debuff() });
      tickDebuffs(target);
      expect(target.debuffs[0].duration).toBe(2);

      expect(applyDebuff({ target: target, debuff: debuff() })).toBe(false);
      expect(target.debuffs).toHaveLength(1);
      expect(target.debuffs[0].duration).toBe(3);
    });

    it("never stacks, whatever maxStack says — that field is a meal's, not a fight's", () => {
      const target = monster();
      applyDebuff({ target: target, debuff: debuff({ maxStack: 2 }) });
      applyDebuff({ target: target, debuff: debuff({ maxStack: 2 }) });
      applyDebuff({ target: target, debuff: debuff({ maxStack: 2 }) });
      expect(target.debuffs).toHaveLength(1);
    });

    it('keeps the longer duration, so a fresh cast cannot cut a running one short', () => {
      const target = monster();
      applyDebuff({ target: target, debuff: debuff({ duration: 6 }) });
      applyDebuff({ target: target, debuff: debuff({ duration: 2 }) });
      expect(target.debuffs[0].duration).toBe(6);
    });

    it('holds one entry per name, so two different debuffs both land', () => {
      const target = monster();
      applyDebuff({ target: target, debuff: debuff() });
      applyDebuff({ target: target, debuff: debuff({ id: 2, name: 'Weakened', effect: 'attack_down' }) });
      expect(target.debuffs).toHaveLength(2);
    });
  });

  describe('debuffedDefense', () => {
    it('leaves an unafflicted monster alone', () => {
      expect(debuffedDefense(monster(), monster().defense)).toBe(100);
    });

    it('shreds the written percentage off the monster armour', () => {
      const target = monster();
      applyDebuff({ target: target, debuff: debuff() });
      expect(debuffedDefense(target, target.defense)).toBe(75);
    });

    it('never takes more than 70%, however hard the debuff hits', () => {
      const target = monster();
      applyDebuff({ target: target, debuff: debuff({ potency: 95 }) });
      expect(debuffedDefense(target, target.defense)).toBe(30);
    });
  });

  describe('debuffedAttack', () => {
    it('weakens the swing by the written percentage', () => {
      const target = monster();
      applyDebuff({ target: target, debuff: debuff({ effect: 'attack_down', potency: 20 }) });
      expect(debuffedAttack(target, 100)).toBe(80);
    });

    it('never silences a monster completely', () => {
      const target = monster();
      applyDebuff({ target: target, debuff: debuff({ effect: 'attack_down', potency: 100 }) });
      expect(debuffedAttack(target, 1)).toBe(1);
    });
  });

  describe('poisonDamage', () => {
    it('burns a share of the health the monster started with', () => {
      const target = monster();
      applyDebuff({ target: target, debuff: debuff({ effect: 'poison', potency: 5 }) });
      expect(poisonDamage({ carrier: target, maxHealth: target.maxHealth })).toBe(25);
    });

    it('is capped so a poison cannot be the whole fight', () => {
      const target = monster();
      applyDebuff({ target: target, debuff: debuff({ effect: 'poison', potency: 60 }) });
      expect(poisonDamage({ carrier: target, maxHealth: target.maxHealth })).toBe(125);
    });

    it('is nothing at all on a monster carrying no poison', () => {
      expect(poisonDamage({ carrier: monster(), maxHealth: monster().maxHealth })).toBe(0);
    });
  });

  describe('tickDebuffs', () => {
    it('drops a debuff once its duration runs out', () => {
      const target = monster();
      applyDebuff({ target: target, debuff: debuff({ duration: 2 }) });

      tickDebuffs(target);
      expect(target.debuffs).toHaveLength(1);

      const expired = tickDebuffs(target);
      expect(expired).toHaveLength(1);
      expect(target.debuffs).toHaveLength(0);
    });
  });

  describe('isStunned', () => {
    it('is true only while a stun is standing', () => {
      const target = monster();
      applyDebuff({ target: target, debuff: debuff({ effect: 'stun', duration: 1 }) });
      expect(isStunned(target)).toBe(true);

      tickDebuffs(target);
      expect(isStunned(target)).toBe(false);
    });
  });
});
