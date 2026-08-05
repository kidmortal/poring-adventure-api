import { Item } from '@prisma/client';
import { Utils } from 'src/utilities/utils';
import {
  buffDurationForQuality,
  canUpgradeQuality,
  consumablePotency,
  enhanceChance,
  enhancePrice,
  itemStatBlock,
  upgradeChance,
} from './items.rules';

const sword = { health: 0, mana: 0, attack: 100, str: 10, agi: 0, int: 0 } as Item;

describe('Item rules', () => {
  describe('qualityMultiplier', () => {
    it('is worth 15% a tier, from Common through Legendary', () => {
      expect(Utils.qualityMultiplier(1)).toBeCloseTo(1);
      expect(Utils.qualityMultiplier(3)).toBeCloseTo(1.3);
      expect(Utils.qualityMultiplier(5)).toBeCloseTo(1.6);
    });

    it('treats an unset quality as Common rather than as nothing', () => {
      expect(Utils.qualityMultiplier(0)).toBeCloseTo(1);
    });
  });

  describe('itemStatsMultiplier', () => {
    it('separates quality from enhancement, so quality counts at +0', () => {
      // The whole point of the split: these used to be identical.
      expect(Utils.itemStatsMultiplier(5, 0)).toBeGreaterThan(Utils.itemStatsMultiplier(1, 0));
    });

    it('still lets quality amplify each enhancement level', () => {
      const commonGain = Utils.itemStatsMultiplier(1, 5) - Utils.itemStatsMultiplier(1, 0);
      const legendaryGain = Utils.itemStatsMultiplier(5, 5) - Utils.itemStatsMultiplier(5, 0);

      expect(legendaryGain).toBeGreaterThan(commonGain);
    });
  });

  describe('itemStatBlock', () => {
    it('makes a legendary sword hit harder than a common one straight off the anvil', () => {
      expect(itemStatBlock({ item: sword, quality: 5, enhancement: 0 }).attack).toBe(160);
      expect(itemStatBlock({ item: sword, quality: 1, enhancement: 0 }).attack).toBe(100);
    });
  });

  describe('consumablePotency', () => {
    it('scales what a potion restores by the quality it was brewed at', () => {
      expect(consumablePotency({ base: 50, quality: 1 })).toBe(50);
      expect(consumablePotency({ base: 50, quality: 5 })).toBe(80);
    });

    it('leaves an item with nothing to restore at nothing', () => {
      expect(consumablePotency({ base: null, quality: 5 })).toBe(0);
      expect(consumablePotency({ base: 0, quality: 5 })).toBe(0);
    });
  });

  describe('buffDurationForQuality', () => {
    it('makes a better cook’s meal last longer rather than hit harder', () => {
      expect(buffDurationForQuality({ duration: 3, quality: 1 })).toBe(3);
      expect(buffDurationForQuality({ duration: 3, quality: 5 })).toBe(4);
    });

    it('never rounds a buff away to nothing', () => {
      expect(buffDurationForQuality({ duration: 1, quality: 1 })).toBe(1);
    });
  });

  describe('enhanceChance', () => {
    it('is certain at +1 and loses a tenth of what is left after', () => {
      expect(enhanceChance(1)).toBe(90);
      expect(enhanceChance(2)).toBe(81);
      expect(enhanceChance(10)).toBe(35);
    });
  });

  describe('enhancePrice', () => {
    it('keeps the old curve for a Common piece of starting gear', () => {
      expect(enhancePrice({ enhancement: 1 })).toBe(150);
      expect(enhancePrice({ enhancement: 3 })).toBe(338);
    });

    it('charges more for the same +1 on higher-tier gear', () => {
      const starter = enhancePrice({ enhancement: 5, requiredLevel: 1, quality: 1 });
      const endgame = enhancePrice({ enhancement: 5, requiredLevel: 41, quality: 1 });

      expect(endgame).toBeGreaterThan(starter);
      expect(endgame).toBe(starter * 5);
    });

    it('charges more for the same +1 on a rarer copy of the same item', () => {
      // Enhancement is worth five times as much on a Legendary, so a forge that
      // charged the same for both was selling the good version at a discount.
      const common = enhancePrice({ enhancement: 5, requiredLevel: 21, quality: 1 });
      const legendary = enhancePrice({ enhancement: 5, requiredLevel: 21, quality: 5 });

      expect(legendary).toBe(common * 3);
    });
  });

  describe('upgradeChance', () => {
    it('falls away as the rarity climbs, and stops at Legendary', () => {
      expect(upgradeChance(1)).toBe(70);
      expect(upgradeChance(2)).toBe(50);
      expect(upgradeChance(3)).toBe(30);
      expect(upgradeChance(4)).toBe(10);
      expect(upgradeChance(5)).toBe(0);
    });
  });

  describe('canUpgradeQuality', () => {
    it('wants the enhancement finished first, and refuses a Legendary outright', () => {
      expect(canUpgradeQuality({ quality: 1, enhancement: 4 })).toBe(false);
      expect(canUpgradeQuality({ quality: 1, enhancement: 5 })).toBe(true);
      expect(canUpgradeQuality({ quality: 4, enhancement: 9 })).toBe(true);
      expect(canUpgradeQuality({ quality: 5, enhancement: 9 })).toBe(false);
    });
  });
});
