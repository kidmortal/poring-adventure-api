import { clampVital, statDelta } from './users.rules';

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
        maxHealth: { increment: 0 },
        maxMana: { increment: 0 },
        attack: { increment: 0 },
        str: { increment: 5 },
        agi: { increment: 0 },
        int: { increment: 0 },
      });
    });

    it('maps health and mana onto the max columns', () => {
      expect(statDelta({ health: 10, mana: 3 }, 'decrement')).toMatchObject({
        maxHealth: { decrement: 10 },
        maxMana: { decrement: 3 },
      });
    });
  });
});
