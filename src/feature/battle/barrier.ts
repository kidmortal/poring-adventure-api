/**
 * Borrowed health, spent before the real thing.
 *
 * A barrier is a flat pool rather than a percentage, which is what makes it the
 * opposite trade to defense: mitigation is worth the same against every hit,
 * while a pool is worth most against the many small hits a pack throws out and
 * least against one enormous swing. That is why it is worth casting on a party
 * that is already armoured, and why the tank is not the only one who wants it.
 *
 * Kept out of `effects.ts` because a barrier is state, not a multiplier applied
 * to a single damage step: what is left of it has to survive to the next hit.
 */

/** The effect string a Buff row carries to be treated as a barrier. */
export const BARRIER_EFFECT = 'barrier';

/** The little a caller needs to expose for its buffs to absorb damage. */
type BarrierCarrier = {
  buff: { effect: string; name: string; image: string };
  barrier?: number;
};

export type BarrierAbsorption = {
  name: string;
  image: string;
  absorbed: number;
};

/**
 * Spends `amount` against the barriers in `buffs`, oldest first so a fresh
 * barrier is not wasted covering a hit the expiring one could have taken.
 *
 * Mutates the pools it drains and reports what each one caught, leaving the
 * logging to the caller. Returns the damage still owed to real health.
 */
export function absorbDamage(args: { buffs: BarrierCarrier[]; amount: number }) {
  const absorptions: BarrierAbsorption[] = [];
  let remaining = args.amount;

  for (const userBuff of args.buffs) {
    if (remaining <= 0) break;
    if (userBuff.buff.effect !== BARRIER_EFFECT || !userBuff.barrier || userBuff.barrier <= 0) continue;

    const absorbed = Math.min(userBuff.barrier, remaining);
    userBuff.barrier -= absorbed;
    remaining -= absorbed;
    absorptions.push({ name: userBuff.buff.name, image: userBuff.buff.image, absorbed });
  }

  return { remaining, absorptions };
}

/**
 * Whether a barrier still has anything in it. A spent barrier is dropped
 * whatever its duration said — an empty one on the bar reads as protection the
 * player does not have.
 */
export function isSpentBarrier(userBuff: BarrierCarrier) {
  return userBuff.buff.effect === BARRIER_EFFECT && !(userBuff.barrier > 0);
}
