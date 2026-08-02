import {
  isGuildBossDifficulty,
  partyKeyFor,
  scaleBoss,
  shareDamageEvenly,
  splitTokensByDamage,
} from './guildBoss.rules';

const boss = { health: 20000, attack: 20, taskPoints: 100, tokens: 100 };

describe('guildBoss.rules', () => {
  describe('scaleBoss', () => {
    it('leaves the row alone on easy', () => {
      expect(scaleBoss(boss, 'easy')).toEqual(boss);
    });

    it('grows health faster than the reward', () => {
      const nightmare = scaleBoss(boss, 'nightmare');
      expect(nightmare.health / boss.health).toBeGreaterThan(nightmare.tokens / boss.tokens);
    });

    it('rounds down to whole numbers', () => {
      const scaled = scaleBoss({ health: 1, attack: 1, taskPoints: 1, tokens: 1 }, 'normal');
      expect(Number.isInteger(scaled.attack)).toBe(true);
    });
  });

  describe('isGuildBossDifficulty', () => {
    it('accepts the four difficulties and nothing else', () => {
      expect(isGuildBossDifficulty('nightmare')).toBe(true);
      expect(isGuildBossDifficulty('impossible')).toBe(false);
    });
  });

  describe('shareDamageEvenly', () => {
    it('gives each of four members a quarter of the score', () => {
      const shared = shareDamageEvenly(2000, ['a', 'b', 'c', 'd']);
      expect(shared).toEqual([
        { userEmail: 'a', damage: 500 },
        { userEmail: 'b', damage: 500 },
        { userEmail: 'c', damage: 500 },
        { userEmail: 'd', damage: 500 },
      ]);
    });

    it('pays the member who fought alone the whole score', () => {
      expect(shareDamageEvenly(750, ['solo'])).toEqual([{ userEmail: 'solo', damage: 750 }]);
    });

    it('hands out every point when it does not divide evenly', () => {
      const shared = shareDamageEvenly(10, ['a', 'b', 'c']);
      expect(shared.reduce((sum, s) => sum + s.damage, 0)).toBe(10);
      expect(shared.map((s) => s.damage).sort()).toEqual([3, 3, 4]);
    });

    it('pays a member who never landed a hit the same as the rest', () => {
      const shared = shareDamageEvenly(100, ['healer', 'striker']);
      expect(shared.find((s) => s.userEmail === 'healer')?.damage).toBe(50);
    });

    it('has nothing to share without damage or without anyone to share with', () => {
      expect(shareDamageEvenly(0, ['a'])).toEqual([]);
      expect(shareDamageEvenly(100, [])).toEqual([]);
    });
  });

  describe('partyKeyFor', () => {
    it('marks a solo fight with no party', () => {
      expect(partyKeyFor(['solo'])).toBeNull();
    });

    it('gives the same party the same key whatever the order', () => {
      expect(partyKeyFor(['b', 'a'])).toBe(partyKeyFor(['a', 'b']));
    });

    it('tells two different parties apart', () => {
      expect(partyKeyFor(['a', 'b'])).not.toBe(partyKeyFor(['a', 'c']));
    });
  });

  describe('splitTokensByDamage', () => {
    it('splits by share of the damage', () => {
      const split = splitTokensByDamage(100, [
        { userEmail: 'a', damage: 750 },
        { userEmail: 'b', damage: 250 },
      ]);
      expect(split).toEqual([
        { userEmail: 'a', tokens: 75 },
        { userEmail: 'b', tokens: 25 },
      ]);
    });

    it('hands the whole pool out, remainder to the top damage', () => {
      const split = splitTokensByDamage(10, [
        { userEmail: 'a', damage: 1 },
        { userEmail: 'b', damage: 1 },
        { userEmail: 'c', damage: 1 },
      ]);
      expect(split.reduce((sum, s) => sum + s.tokens, 0)).toBe(10);
    });

    it('never rounds a contributor away to nothing', () => {
      const split = splitTokensByDamage(10, [
        { userEmail: 'whale', damage: 100000 },
        { userEmail: 'healer', damage: 1 },
      ]);
      expect(split.find((s) => s.userEmail === 'healer')?.tokens).toBe(1);
    });

    it('ignores members who never landed a hit', () => {
      const split = splitTokensByDamage(10, [
        { userEmail: 'a', damage: 5 },
        { userEmail: 'afk', damage: 0 },
      ]);
      expect(split).toEqual([{ userEmail: 'a', tokens: 10 }]);
    });

    it('has nothing to split without damage', () => {
      expect(splitTokensByDamage(10, [])).toEqual([]);
    });
  });
});
