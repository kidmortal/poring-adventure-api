import { listingFee, settleSale } from './market.rules';

describe('Market rules', () => {
  describe('settleSale', () => {
    it('charges the buyer the price on the board and takes the tax off the seller', () => {
      expect(settleSale({ price: 1000, stacks: 1 })).toEqual({ total: 1000, tax: 50, payout: 950 });
    });

    it('taxes the whole order, not each stack', () => {
      expect(settleSale({ price: 200, stacks: 5 })).toEqual({ total: 1000, tax: 50, payout: 950 });
    });

    it('rounds the tax down, so a cheap sale is untaxed rather than free money', () => {
      expect(settleSale({ price: 1, stacks: 1 })).toEqual({ total: 1, tax: 0, payout: 1 });
    });

    it('never pays out more than came in', () => {
      const { total, tax, payout } = settleSale({ price: 733, stacks: 7 });
      expect(tax + payout).toBe(total);
    });
  });

  describe('listingFee', () => {
    it('takes two percent of what is being asked', () => {
      expect(listingFee({ price: 1000, stacks: 3 })).toBe(60);
    });

    it('is free below the point where a percent rounds to anything', () => {
      expect(listingFee({ price: 10, stacks: 1 })).toBe(0);
    });
  });
});
