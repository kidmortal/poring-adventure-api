import {
  BASE_MAX_STAMINA,
  craftQualityChances,
  enhancementAfterFailure,
  failureCostsALevel,
  rollCraftQuality,
  ENHANCE_SERVICE_STAMINA_COST,
  hiredEnhanceBonus,
  hiredEnhanceChance,
  maxStaminaForProfession,
  planIngredientConsumption,
  rollNodeDrops,
  SETBACK_FLOOR,
  serviceExperience,
  serviceFee,
} from './profession.rules';

describe('profession rules', () => {
  describe('serviceFee', () => {
    it('prices a job by the stamina it burns', () => {
      expect(serviceFee({ staminaCost: 10, pricePerStamina: 50 })).toBe(500);
    });
  });

  describe('serviceExperience', () => {
    it('pays two experience per stamina point spent on the job', () => {
      expect(serviceExperience({ staminaCost: ENHANCE_SERVICE_STAMINA_COST })).toBe(20);
      expect(serviceExperience({ staminaCost: 5 })).toBe(10);
    });
  });

  describe('craftQualityChances', () => {
    it('always adds up to a whole roll', () => {
      [1, 5, 12, 30, 99].forEach((level) => {
        const total = craftQualityChances({ level }).reduce((sum, entry) => sum + entry.chance, 0);
        expect(total).toBe(100);
      });
    });

    it('moves weight out of common as the crafter levels', () => {
      const novice = craftQualityChances({ level: 1 });
      const veteran = craftQualityChances({ level: 20 });

      expect(novice[0].chance).toBeGreaterThan(veteran[0].chance);
      expect(veteran[4].chance).toBeGreaterThan(novice[4].chance);
    });

    it('caps every tier, so no level guarantees a legendary', () => {
      const master = craftQualityChances({ level: 999 });

      expect(master.find((entry) => entry.quality === 5)?.chance).toBe(8);
      expect(master.find((entry) => entry.quality === 1)?.chance).toBe(15);
    });
  });

  describe('rollCraftQuality', () => {
    afterEach(() => jest.restoreAllMocks());

    it('lands on common for a low roll and on the best tier for a high one', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0);
      expect(rollCraftQuality({ level: 20 })).toBe(1);

      jest.spyOn(Math, 'random').mockReturnValue(0.999);
      expect(rollCraftQuality({ level: 20 })).toBe(5);
    });
  });

  describe('hiredEnhanceBonus', () => {
    it('adds a tenth of the base chance per blacksmith level', () => {
      expect(hiredEnhanceBonus({ baseChance: 50, blacksmithLevel: 1 })).toBe(5);
      expect(hiredEnhanceBonus({ baseChance: 50, blacksmithLevel: 3 })).toBe(15);
    });

    it('never pushes the odds past certainty', () => {
      expect(hiredEnhanceChance({ baseChance: 90, blacksmithLevel: 20 })).toBe(100);
      expect(hiredEnhanceBonus({ baseChance: 90, blacksmithLevel: 20 })).toBe(10);
    });

    it('is worth little where the odds are already bad', () => {
      expect(hiredEnhanceBonus({ baseChance: 10, blacksmithLevel: 2 })).toBe(2);
    });
  });

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

describe('Enhancement setback', () => {
  it('leaves the item where it is below the threshold — the silver is the only loss', () => {
    for (let current = 0; current < 5; current++) {
      expect(enhancementAfterFailure({ current })).toBe(current);
      expect(failureCostsALevel({ current })).toBe(false);
    }
  });

  it('costs a level once the item is past the threshold', () => {
    expect(enhancementAfterFailure({ current: 6 })).toBe(5);
    expect(enhancementAfterFailure({ current: 7 })).toBe(6);
    expect(enhancementAfterFailure({ current: 9 })).toBe(8);
    expect(failureCostsALevel({ current: 7 })).toBe(true);
  });

  it('never falls below the floor, so no run of luck erases a week of work', () => {
    let enhancement = 9;
    for (let attempt = 0; attempt < 20; attempt++) {
      enhancement = enhancementAfterFailure({ current: enhancement });
    }
    expect(enhancement).toBe(SETBACK_FLOOR);
  });

  it('protects the level the floor sits on', () => {
    expect(enhancementAfterFailure({ current: 5 })).toBe(5);
  });
});

describe('Stamina from profession level', () => {
  it('starts every player on the base budget', () => {
    expect(maxStaminaForProfession({ level: 1 })).toBe(BASE_MAX_STAMINA);
  });

  it('adds a point every two levels', () => {
    expect(maxStaminaForProfession({ level: 2 })).toBe(BASE_MAX_STAMINA + 1);
    expect(maxStaminaForProfession({ level: 20 })).toBe(BASE_MAX_STAMINA + 10);
    expect(maxStaminaForProfession({ level: 50 })).toBe(BASE_MAX_STAMINA + 25);
  });

  it('carries a guild blessing on top of what the trade earned', () => {
    expect(maxStaminaForProfession({ level: 20, bonus: 5 })).toBe(BASE_MAX_STAMINA + 10 + 5);
    expect(maxStaminaForProfession({ level: 1, bonus: 0 })).toBe(BASE_MAX_STAMINA);
  });

  it('never goes backwards as the level climbs', () => {
    for (let level = 1; level < 50; level++) {
      expect(maxStaminaForProfession({ level: level + 1 })).toBeGreaterThanOrEqual(maxStaminaForProfession({ level }));
    }
  });
});
