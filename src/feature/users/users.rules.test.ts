import { clampVital, isNewDay, statDelta } from './users.rules';

describe('users rules', () => {
  describe('clampVital', () => {
    it('adds the amount when it stays within range', () => {
      expect(clampVital({ current: 30, amount: 10, max: 50 })).toBe(40);
    });

    it('never overflows the max', () => {
      expect(clampVital({ current: 40, amount: 25, max: 50 })).toBe(50);
    });

    it('subtracts when the amount is negative', () => {
      expect(clampVital({ current: 30, amount: -20, max: 50 })).toBe(10);
    });

    it('never drops below zero', () => {
      expect(clampVital({ current: 15, amount: -25, max: 20 })).toBe(0);
    });

    it('applies no ceiling when max is unknown', () => {
      expect(clampVital({ current: 30, amount: -20, max: undefined })).toBe(10);
      expect(clampVital({ current: 30, amount: 500, max: undefined })).toBe(530);
    });
  });

  describe('statDelta', () => {
    it('defaults every untouched stat to zero', () => {
      expect(statDelta({ str: 5 }, 'increment')).toEqual({
        level: { increment: 0 },
        defense: { increment: 0 },
        maxHealth: { increment: 0 },
        maxMana: { increment: 0 },
        attack: { increment: 0 },
        str: { increment: 5 },
        agi: { increment: 0 },
        int: { increment: 0 },
        critRate: { increment: 0 },
        critDamage: { increment: 0 },
      });
    });

    it('maps health and mana onto the max columns', () => {
      expect(statDelta({ health: 10, mana: 3 }, 'decrement')).toMatchObject({
        maxHealth: { decrement: 10 },
        maxMana: { decrement: 3 },
      });
    });
  });

  describe('isNewDay', () => {
    it('refills when the last refill was on an earlier day', () => {
      expect(isNewDay(new Date('2024-07-31T23:59:00Z'), new Date('2024-08-01T00:01:00Z'))).toBe(true);
    });

    it('does not refill twice on the same day', () => {
      expect(isNewDay(new Date('2024-08-01T00:01:00Z'), new Date('2024-08-01T23:59:00Z'))).toBe(false);
    });

    it('compares the whole date, not just the day number', () => {
      expect(isNewDay(new Date('2024-07-01T10:00:00Z'), new Date('2024-08-01T10:00:00Z'))).toBe(true);
      expect(isNewDay(new Date('2023-08-01T10:00:00Z'), new Date('2024-08-01T10:00:00Z'))).toBe(true);
    });

    it('refills when no refill was ever recorded', () => {
      expect(isNewDay(undefined, new Date())).toBe(true);
    });
  });
});
