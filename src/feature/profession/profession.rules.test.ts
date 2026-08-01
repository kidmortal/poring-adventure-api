import { planIngredientConsumption, rollNodeDrops } from './profession.rules';

describe('profession rules', () => {
  describe('rollNodeDrops', () => {
    afterEach(() => jest.restoreAllMocks());

    it('keeps every drop that passes its chance roll', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0);
      const drops = rollNodeDrops([
        { itemId: 1, chance: 90, minAmount: 2, maxAmount: 2 },
        { itemId: 2, chance: 20, minAmount: 1, maxAmount: 1 },
      ]);

      expect(drops).toEqual([
        { itemId: 1, amount: 2 },
        { itemId: 2, amount: 1 },
      ]);
    });

    it('drops nothing when every roll fails', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.99);
      const drops = rollNodeDrops([{ itemId: 1, chance: 90, minAmount: 1, maxAmount: 3 }]);

      expect(drops).toEqual([]);
    });

    it('rolls each drop on its own, so a rare item can miss while a common one lands', () => {
      // 0.5 -> 50, which passes a 90% chance and fails a 20% one.
      jest.spyOn(Math, 'random').mockReturnValue(0.5);
      const drops = rollNodeDrops([
        { itemId: 1, chance: 90, minAmount: 1, maxAmount: 1 },
        { itemId: 2, chance: 20, minAmount: 1, maxAmount: 1 },
      ]);

      expect(drops).toEqual([{ itemId: 1, amount: 1 }]);
    });
  });

  describe('planIngredientConsumption', () => {
    it('takes an ingredient from a single stack when it is big enough', () => {
      const plan = planIngredientConsumption({
        required: [{ itemId: 1, amount: 3 }],
        owned: [{ id: 10, itemId: 1, stack: 5 }],
      });

      expect(plan).toEqual([{ inventoryId: 10, stack: 3 }]);
    });

    it('spreads one ingredient across several stacks of the same item', () => {
      const plan = planIngredientConsumption({
        required: [{ itemId: 1, amount: 4 }],
        owned: [
          { id: 10, itemId: 1, stack: 1 },
          { id: 11, itemId: 1, stack: 9 },
        ],
      });

      expect(plan).toEqual([
        { inventoryId: 10, stack: 1 },
        { inventoryId: 11, stack: 3 },
      ]);
    });

    it('returns null when the user is short, so nothing is consumed', () => {
      const plan = planIngredientConsumption({
        required: [
          { itemId: 1, amount: 2 },
          { itemId: 2, amount: 2 },
        ],
        owned: [
          { id: 10, itemId: 1, stack: 5 },
          { id: 11, itemId: 2, stack: 1 },
        ],
      });

      expect(plan).toBeNull();
    });

    it('returns null when the user owns none of an ingredient', () => {
      const plan = planIngredientConsumption({
        required: [{ itemId: 99, amount: 1 }],
        owned: [{ id: 10, itemId: 1, stack: 5 }],
      });

      expect(plan).toBeNull();
    });
  });
});
