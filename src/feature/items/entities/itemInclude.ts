import { Prisma } from '@prisma/client';

/**
 * An item, with the buff that makes it what it is.
 *
 * A meal has no stat block at all — its entire effect is the buff it grants —
 * so an item sent to a client without this include arrives looking like an
 * inert material. Use it anywhere an item is on its way to a player: the
 * inventory, recipes, node tables, the market, the commission board, drops.
 *
 * Equipment never carries a buff, so including it there costs a null column and
 * saves every caller from having to know which category it is looking at.
 */
export const ITEM_WITH_BUFF = { include: { buff: true } } as const;

/** The same shape as a type, for `Prisma.*GetPayload` declarations. */
export type ItemWithBuff = Prisma.ItemGetPayload<typeof ITEM_WITH_BUFF>;
