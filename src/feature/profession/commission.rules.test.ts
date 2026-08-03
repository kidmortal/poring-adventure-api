import { DAILY_COMMISSION_SLOTS, pickDailyCommissions, utcDayKey } from './commission.rules';

describe('Commission rules', () => {
  const available = Array.from({ length: 12 }, (_, index) => ({
    id: index + 1,
    professionId: index < 8 ? 1 : 2,
    requiredLevel: index < 4 ? 1 : 20,
  }));

  const board = (overrides: Partial<Parameters<typeof pickDailyCommissions>[0]> = {}) =>
    pickDailyCommissions({
      available,
      userEmail: 'cook@test.com',
      professionId: 1,
      level: 30,
      day: '2026-7-3',
      ...overrides,
    });

  it('offers a fixed number of contracts', () => {
    expect(board()).toHaveLength(DAILY_COMMISSION_SLOTS);
  });

  it('gives the same board twice for the same player and day', () => {
    expect(board()).toEqual(board());
  });

  it('draws a different board tomorrow', () => {
    expect(board({ day: '2026-7-4' })).not.toEqual(board());
  });

  it('draws a different board for a different player', () => {
    expect(board({ userEmail: 'smith@test.com' })).not.toEqual(board());
  });

  it('never offers another profession work', () => {
    expect(board().every((commission) => commission.professionId === 1)).toBe(true);
  });

  it('withholds contracts the player has not levelled into', () => {
    expect(board({ level: 1 }).every((commission) => commission.requiredLevel === 1)).toBe(true);
  });

  it('offers what there is when the pool is smaller than the board', () => {
    expect(board({ professionId: 2, level: 30 })).toHaveLength(4);
    expect(board({ available: available.slice(0, 2) })).toHaveLength(2);
  });

  it('keys the day in UTC, so the board turns over at the same moment everywhere', () => {
    expect(utcDayKey(new Date('2026-08-03T23:59:00Z'))).toEqual(utcDayKey(new Date('2026-08-03T00:01:00Z')));
    expect(utcDayKey(new Date('2026-08-04T00:01:00Z'))).not.toEqual(utcDayKey(new Date('2026-08-03T23:59:00Z')));
  });
});
