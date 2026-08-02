import { Prisma, PrismaClient } from '@prisma/client';
import { DefaultArgs } from '@prisma/client/runtime/library';

export type TransactionContext = Omit<
  PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Interactive transactions run against a remote database, so every statement is
 * a network round trip. Prisma's five second default is not enough for the
 * multi-step ones (battle rewards, hired jobs), which is why these are passed
 * explicitly wherever a transaction does more than a couple of writes.
 */
export const TRANSACTION_OPTIONS = {
  /** How long the work inside may take. */
  timeout: 20_000,
  /** How long to wait for a connection before starting. */
  maxWait: 10_000,
};
