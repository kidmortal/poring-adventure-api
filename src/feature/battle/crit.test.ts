import { Buff, UserBuff } from '@prisma/client';
import { applyCritical, critDamage, critRate, MAX_CRIT_RATE, rollCritical, rollsCritical } from './crit';

function buff(bonus: { critRateBonus?: number; critDamageBonus?: number }) {
  return {
    duration: 3,
    buff: { critRateBonus: 0, critDamageBonus: 0, ...bonus } as Buff,
  } as UserBuff & { buff: Buff };
}

describe('crit rate', () => {
  it('is the character stat when nothing is buffing it', () => {
    expect(critRate({ stats: { critRate: 5 } })).toBe(5);
  });

  it('falls back to the base rate for a character with no crit stat at all', () => {
    expect(critRate({ stats: {} })).toBe(5);
  });

  it('adds every buff holding a rate bonus', () => {
    const buffs = [buff({ critRateBonus: 10 }), buff({ critRateBonus: 5 })];
    expect(critRate({ stats: { critRate: 20 }, buffs })).toBe(35);
  });

  it('never passes the cap, so a crit is never a certainty', () => {
    const buffs = [buff({ critRateBonus: 200 })];
    expect(critRate({ stats: { critRate: 50 }, buffs })).toBe(MAX_CRIT_RATE);
  });
});

describe('crit damage', () => {
  it('adds buff bonuses to the character stat', () => {
    expect(critDamage({ stats: { critDamage: 200 }, buffs: [buff({ critDamageBonus: 50 })] })).toBe(250);
  });

  it('is never worth less than a plain hit', () => {
    expect(critDamage({ stats: { critDamage: 20 } })).toBe(100);
  });
});

describe('rolling', () => {
  it('crits when the roll lands under the rate', () => {
    expect(rollsCritical({ rate: 5, roll: 4.9 })).toBe(true);
    expect(rollsCritical({ rate: 5, roll: 5 })).toBe(false);
  });

  it('doubles the value at the default crit damage', () => {
    expect(applyCritical(100, 200)).toBe(200);
  });

  it('hands back the plain value, floored, when the roll misses', () => {
    expect(rollCritical({ value: 10.9, stats: { critRate: 5 }, roll: 99 })).toEqual({ value: 10, critical: false });
  });

  it('hands back the multiplied value when it lands', () => {
    const rolled = rollCritical({ value: 100, stats: { critRate: 100, critDamage: 250 }, roll: 0 });
    expect(rolled).toEqual({ value: 250, critical: true });
  });
});
