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
      expect(applyDebuff({ monster: target, debuff: debuff() })).toBe(true);
      expect(target.debuffs).toHaveLength(1);
      expect(target.debuffs[0]).toMatchObject({ name: 'Sundered', image: 'sunder.webp', duration: 3 });
    });

    it('refreshes rather than stacking past the debuff maxStack', () => {
      const target = monster();
      applyDebuff({ monster: target, debuff: debuff() });
      tickDebuffs(target);
      expect(target.debuffs[0].duration).toBe(2);

      expect(applyDebuff({ monster: target, debuff: debuff() })).toBe(false);
      expect(target.debuffs).toHaveLength(1);
      expect(target.debuffs[0].duration).toBe(3);
    });

    it('stacks up to the maxStack the debuff allows', () => {
      const target = monster();
      applyDebuff({ monster: target, debuff: debuff({ maxStack: 2 }) });
      applyDebuff({ monster: target, debuff: debuff({ maxStack: 2 }) });
      applyDebuff({ monster: target, debuff: debuff({ maxStack: 2 }) });
      expect(target.debuffs).toHaveLength(2);
    });
  });

  describe('debuffedDefense', () => {
    it('leaves an unafflicted monster alone', () => {
      expect(debuffedDefense(monster())).toBe(100);
    });

    it('shreds the written percentage off the monster armour', () => {
      const target = monster();
      applyDebuff({ monster: target, debuff: debuff() });
      expect(debuffedDefense(target)).toBe(75);
    });

    it('never takes more than 70% however many copies are stacked', () => {
      const target = monster();
      [1, 2, 3, 4].forEach((id) => applyDebuff({ monster: target, debuff: debuff({ id, maxStack: 4 }) }));
      expect(debuffedDefense(target)).toBe(30);
    });
  });

  describe('debuffedAttack', () => {
    it('weakens the swing by the written percentage', () => {
      const target = monster();
      applyDebuff({ monster: target, debuff: debuff({ effect: 'attack_down', potency: 20 }) });
      expect(debuffedAttack(target, 100)).toBe(80);
    });

    it('never silences a monster completely', () => {
      const target = monster();
      applyDebuff({ monster: target, debuff: debuff({ effect: 'attack_down', potency: 100 }) });
      expect(debuffedAttack(target, 1)).toBe(1);
    });
  });

  describe('poisonDamage', () => {
    it('burns a share of the health the monster started with', () => {
      const target = monster();
      applyDebuff({ monster: target, debuff: debuff({ effect: 'poison', potency: 5 }) });
      expect(poisonDamage(target)).toBe(25);
    });

    it('is capped so a stack of poisons cannot be the whole fight', () => {
      const target = monster();
      [1, 2, 3, 4, 5, 6].forEach((id) =>
        applyDebuff({ monster: target, debuff: debuff({ id, effect: 'poison', potency: 10, maxStack: 6 }) }),
      );
      expect(poisonDamage(target)).toBe(125);
    });

    it('is nothing at all on a monster carrying no poison', () => {
      expect(poisonDamage(monster())).toBe(0);
    });
  });

  describe('tickDebuffs', () => {
    it('drops a debuff once its duration runs out', () => {
      const target = monster();
      applyDebuff({ monster: target, debuff: debuff({ duration: 2 }) });

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
      applyDebuff({ monster: target, debuff: debuff({ effect: 'stun', duration: 1 }) });
      expect(isStunned(target)).toBe(true);

      tickDebuffs(target);
      expect(isStunned(target)).toBe(false);
    });
  });
});
