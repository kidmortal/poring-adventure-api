import { ALLOWED_BLESSINGS, UPGRADE_FACTOR } from './constants';
import {
  BLESSING_BASE_COST,
  MAX_BLESSING_LEVEL,
  blessingLevel,
  blessingUpgradeCost,
  canUpgradeBlessing,
  levelChange,
} from './guild.rules';

describe('guild.rules', () => {
  describe('levelChange', () => {
    it('says nothing when the guild is already at its level', () => {
      expect(levelChange({ currentLevel: 3, correctLevel: 3 })).toEqual({});
    });

    it('moves in either direction', () => {
      expect(levelChange({ currentLevel: 3, correctLevel: 5 })).toEqual({ level: { increment: 2 } });
      expect(levelChange({ currentLevel: 5, correctLevel: 3 })).toEqual({ level: { decrement: 2 } });
    });
  });

  describe('blessingLevel', () => {
    it('reads the level back out of the stat granted', () => {
      expect(blessingLevel({ current: 0, factor: 5 })).toBe(0);
      expect(blessingLevel({ current: 25, factor: 5 })).toBe(5);
      expect(blessingLevel({ current: 3, factor: 1 })).toBe(3);
    });

    it('rounds a part-level down rather than charging for it', () => {
      expect(blessingLevel({ current: 7, factor: 5 })).toBe(1);
    });
  });

  describe('blessingUpgradeCost', () => {
    it('charges the base cost for the first level', () => {
      expect(blessingUpgradeCost({ level: 0 })).toBe(BLESSING_BASE_COST);
    });

    it('costs more every level', () => {
      for (let level = 0; level < MAX_BLESSING_LEVEL; level++) {
        expect(blessingUpgradeCost({ level: level + 1 })).toBeGreaterThan(blessingUpgradeCost({ level }));
      }
    });

    it('makes the last level a serious commitment', () => {
      const last = blessingUpgradeCost({ level: MAX_BLESSING_LEVEL - 1 });
      expect(last).toBeGreaterThan(BLESSING_BASE_COST * 100);
    });

    it('prices every blessing the same, whatever the stat is worth', () => {
      const costs = ALLOWED_BLESSINGS.map(() => blessingUpgradeCost({ level: 4 }));
      expect(new Set(costs).size).toBe(1);
    });
  });

  describe('canUpgradeBlessing', () => {
    it('stops at the cap', () => {
      expect(canUpgradeBlessing({ level: MAX_BLESSING_LEVEL - 1 })).toBe(true);
      expect(canUpgradeBlessing({ level: MAX_BLESSING_LEVEL })).toBe(false);
    });
  });

  describe('the blessing list', () => {
    it('has a step for every blessing that may be bought', () => {
      ALLOWED_BLESSINGS.forEach((blessing) => expect(UPGRADE_FACTOR[blessing]).toBeGreaterThan(0));
    });

    it('carries the stats the combat rebuild gave everyone, and the crafter one', () => {
      expect(ALLOWED_BLESSINGS).toEqual(expect.arrayContaining(['defense', 'critRate', 'critDamage', 'stamina']));
    });
  });
});
