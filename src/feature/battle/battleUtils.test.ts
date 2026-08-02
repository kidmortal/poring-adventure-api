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
});
