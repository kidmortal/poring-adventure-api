import { Item } from '@prisma/client';
import { Utils } from 'src/utilities/utils';
import { buffDurationForQuality, consumablePotency, itemStatBlock } from './items.rules';

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
});
