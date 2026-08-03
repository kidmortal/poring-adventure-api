/**
 * The market's two silver sinks — pure arithmetic, no database.
 *
 * Silver entered the game from every kill and left it almost nowhere: buying
 * from another player moved 100% of the price across, so the only sink in the
 * whole economy was the enhancement forge, which is one profession's niche.
 * Prices inflate under that, and crafted goods — whose supply is capped by
 * stamina — fall behind fastest.
 *
 * A percentage cut is the cleanest fix available: it scales with the economy
 * without anyone tuning it, it is invisible at small volumes, and it never
 * punishes a player for doing the thing the game wants them to do.
 */

/** Share of every sale that is burned rather than paid to the seller. */
export const SALE_TAX_RATE = 0.05;

/** Share of a listing's asking value charged up front, and never refunded. */
export const LISTING_FEE_RATE = 0.02;

/**
 * What the seller actually receives, and what the world swallows.
 *
 * The buyer pays the full asking price either way — the tax comes out of the
 * seller's side, so a listing's price means what it says on the board.
 */
export function settleSale(args: { price: number; stacks: number }) {
  const total = args.price * args.stacks;
  const tax = Math.floor(total * SALE_TAX_RATE);
  return { total, tax, payout: total - tax };
}

/**
 * The up-front cost of putting stacks on the board.
 *
 * Non-refundable on purpose: it is what makes a wall of speculative listings, or
 * a price-fishing re-list every ten minutes, cost something.
 */
export function listingFee(args: { price: number; stacks: number }) {
  return Math.floor(args.price * args.stacks * LISTING_FEE_RATE);
}
