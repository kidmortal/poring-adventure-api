import { absorbDamage, isSpentBarrier } from './barrier';

function barrier(name: string, amount: number) {
  return { buff: { effect: 'barrier', name, image: `${name}.webp` }, barrier: amount };
}

function meal() {
  return { buff: { effect: 'well_fed', name: 'Well Fed', image: 'fish.webp' }, barrier: undefined };
}

describe('barrier', () => {
  describe('absorbDamage', () => {
    it('takes the hit in place of health while the pool covers it', () => {
      const buffs = [barrier('Aegis', 50)];

      const { remaining, absorptions } = absorbDamage({ buffs, amount: 30 });

      expect(remaining).toBe(0);
      expect(buffs[0].barrier).toBe(20);
      expect(absorptions).toEqual([{ name: 'Aegis', image: 'Aegis.webp', absorbed: 30 }]);
    });

    it('passes the overflow through to health once the pool is empty', () => {
      const buffs = [barrier('Aegis', 20)];

      const { remaining } = absorbDamage({ buffs, amount: 50 });

      expect(remaining).toBe(30);
      expect(buffs[0].barrier).toBe(0);
    });

    it('spends the oldest barrier first, so a fresh one is not wasted', () => {
      const buffs = [barrier('Aegis', 10), barrier('Mana Shield', 100)];

      const { remaining, absorptions } = absorbDamage({ buffs, amount: 40 });

      expect(remaining).toBe(0);
      expect(buffs[0].barrier).toBe(0);
      expect(buffs[1].barrier).toBe(70);
      expect(absorptions.map((entry) => entry.name)).toEqual(['Aegis', 'Mana Shield']);
    });

    it('leaves buffs that are not barriers alone', () => {
      const buffs = [meal(), barrier('Aegis', 10)];

      const { remaining, absorptions } = absorbDamage({ buffs, amount: 25 });

      expect(remaining).toBe(15);
      expect(absorptions).toHaveLength(1);
      expect(buffs[0].barrier).toBeUndefined();
    });

    it('is a no-op for a player carrying nothing', () => {
      expect(absorbDamage({ buffs: [], amount: 17 })).toEqual({ remaining: 17, absorptions: [] });
    });
  });

  describe('isSpentBarrier', () => {
    it('is true only of a barrier with nothing left in it', () => {
      expect(isSpentBarrier(barrier('Aegis', 0))).toBe(true);
      expect(isSpentBarrier(barrier('Aegis', 1))).toBe(false);
      // A meal has no pool and is not a barrier: it must survive the sweep.
      expect(isSpentBarrier(meal())).toBe(false);
    });
  });
});
