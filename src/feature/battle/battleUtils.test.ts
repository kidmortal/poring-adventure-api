import { BattleUtils } from './battleUtils';

describe('BattleUtils', () => {
  describe('enragedDamage', () => {
    it('leaves the first enraged swing at its base damage', () => {
      expect(BattleUtils.enragedDamage(100, 0, 1.3)).toBe(100);
    });

    it('adds 30% for every swing already taken', () => {
      expect(BattleUtils.enragedDamage(100, 1, 1.3)).toBe(130);
      expect(BattleUtils.enragedDamage(100, 2, 1.3)).toBe(169);
      expect(BattleUtils.enragedDamage(100, 3, 1.3)).toBe(219);
    });

    it('climbs fast enough to end a fight it is losing', () => {
      // Ten swings in, a 25 damage boss hits for over 250.
      expect(BattleUtils.enragedDamage(25, 10, 1.3)).toBeGreaterThan(250);
    });

    it('stays a whole number', () => {
      expect(Number.isInteger(BattleUtils.enragedDamage(7, 3, 1.3))).toBe(true);
    });

    it('is unchanged for a monster that never enrages', () => {
      expect(BattleUtils.enragedDamage(42, -1, 1.3)).toBe(42);
    });
  });

  describe('mitigate', () => {
    it('leaves a hit alone when the defender has no defense', () => {
      expect(BattleUtils.mitigate({ raw: 100, defense: 0, attackerLevel: 10 })).toBe(100);
    });

    it('reduces the hit as defense climbs', () => {
      const light = BattleUtils.mitigate({ raw: 100, defense: 20, attackerLevel: 10 });
      const heavy = BattleUtils.mitigate({ raw: 100, defense: 200, attackerLevel: 10 });
      expect(heavy).toBeLessThan(light);
      expect(light).toBeLessThan(100);
    });

    it('is worth less against a higher level attacker', () => {
      const versusLow = BattleUtils.mitigate({ raw: 100, defense: 60, attackerLevel: 5 });
      const versusHigh = BattleUtils.mitigate({ raw: 100, defense: 60, attackerLevel: 50 });
      expect(versusHigh).toBeGreaterThan(versusLow);
    });

    it('never reduces a hit past the 75% cap, however absurd the defense', () => {
      expect(BattleUtils.mitigate({ raw: 100, defense: 999999, attackerLevel: 1 })).toBe(25);
    });

    it('always costs at least one health', () => {
      expect(BattleUtils.mitigate({ raw: 1, defense: 999999, attackerLevel: 1 })).toBe(1);
    });
  });

  describe('effectiveDefense', () => {
    it('adds one point of defense per two points of strength', () => {
      expect(BattleUtils.effectiveDefense({ defense: 10, str: 7 })).toBe(13);
    });

    it('treats missing stats as zero', () => {
      expect(BattleUtils.effectiveDefense({})).toBe(0);
    });
  });

  describe('evasionChance', () => {
    it('is zero for a character with no agility', () => {
      expect(BattleUtils.evasionChance(0)).toBe(0);
    });

    it('caps at 20%, so speed never means immunity', () => {
      expect(BattleUtils.evasionChance(100000)).toBe(0.2);
    });
  });

  describe('generateBattleAttackOrder', () => {
    const user = (name: string, agi: number) => ({ name, stats: { agi } }) as never;
    const monster = (name: string, agi: number, level = 1) => ({ name, agi, level }) as never;

    it('orders everyone by speed rather than by party position', () => {
      const order = BattleUtils.generateBattleAttackOrder(
        [user('Priest', 2), user('Assassin', 40)],
        [monster('Poring', 10)],
      );
      expect(order).toEqual(['Assassin', 'Poring', 'Priest']);
    });

    it('falls back to a monster level for monsters seeded before agi existed', () => {
      const order = BattleUtils.generateBattleAttackOrder([user('Mage', 5)], [monster('Old Boss', 0, 30)]);
      expect(order).toEqual(['Old Boss', 'Mage']);
    });
  });
});
