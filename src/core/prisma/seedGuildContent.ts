/**
 * Seeds the content rows the guild store and the guild boss need. Idempotent —
 * it upserts by name, so running it again on a live database only refreshes the
 * numbers. Run with:
 *
 *   npx ts-node -r tsconfig-paths/register src/core/prisma/seedGuildContent.ts
 */
import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

// Blank the two TURSO vars to seed the local dev.db instead of the remote one.
const libsql = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:dev.db',
  authToken: process.env.TURSO_AUTH_TOKEN || '',
});
const prisma = new PrismaClient({ adapter: new PrismaLibSQL(libsql) });

/** The shelf, priced in guild tokens. Both potions already exist as items. */
const STORE = [
  { itemName: 'Healing Potion', price: 15, stack: 1 },
  { itemName: 'Mana Potion', price: 15, stack: 1 },
];

/**
 * Easy-difficulty numbers; normal through nightmare multiply them. The art and
 * the names are the boss monsters that already exist in the Monster table.
 */
const BOSSES = [
  {
    name: 'King Poring',
    image: 'https://kidmortal.sirv.com/monsters/king_poring.gif?w=100&h=100',
    level: 10,
    health: 20000,
    attack: 25,
    taskPoints: 100,
    tokens: 100,
    silver: 150,
    exp: 200,
    requiredGuildLevel: 1,
  },
  {
    name: 'Kades',
    image: 'https://kidmortal.sirv.com/monsters/kades.gif?w=100&h=100',
    level: 30,
    health: 80000,
    attack: 70,
    taskPoints: 300,
    tokens: 300,
    silver: 400,
    exp: 600,
    requiredGuildLevel: 5,
  },
];

async function main() {
  for (const { itemName, price, stack } of STORE) {
    const item = await prisma.item.findFirst({ where: { name: itemName } });
    if (!item) {
      console.warn(`skipping ${itemName} — no such item`);
      continue;
    }
    await prisma.guildStoreProduct.upsert({
      where: { itemId: item.id },
      create: { itemId: item.id, price, stack, enabled: true },
      update: { price, stack, enabled: true },
    });
    console.log(`store: ${itemName} at ${price} tokens`);
  }

  for (const boss of BOSSES) {
    await prisma.guildBoss.upsert({
      where: { name: boss.name },
      create: boss,
      update: boss,
    });
    console.log(`boss: ${boss.name}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
