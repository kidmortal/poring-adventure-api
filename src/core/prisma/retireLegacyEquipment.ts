/**
 * One-off cleanup for the equipment refactor: removes the gear that predates
 * the tiered catalog and pays players back for what they held.
 *
 *   npx ts-node -r tsconfig-paths/register src/core/prisma/retireLegacyEquipment.ts          # dry run
 *   npx ts-node -r tsconfig-paths/register src/core/prisma/retireLegacyEquipment.ts --apply  # writes
 *
 * Legacy gear is any equippable item that the new catalog does not name. It is
 * unequipped before it is deleted — equipping writes an item's stats onto the
 * Stats row, so deleting a worn item without unwinding it would leave the
 * character permanently inflated.
 *
 * Prints exactly what it would do and changes nothing unless `--apply` is
 * passed. Point TURSO_DATABASE_URL at the deployed database to run it there.
 */
import { statDelta } from 'src/feature/users/users.rules';
import { itemStatBlock } from 'src/feature/items/items.rules';

import { prisma } from './seed/client';
import { gearCatalog } from './seed/equipment';

/** Paid per unit held, whatever the piece was — mail keeps it simple. */
const SILVER_PER_UNIT = 100;

const EQUIPPABLE = ['weapon', 'armor', 'legs', 'boots', 'equipment', 'accessory'];

const apply = process.argv.includes('--apply');

async function main() {
  const keep = new Set(gearCatalog().map((piece) => piece.name));
  const legacy = await prisma.item.findMany({
    where: { category: { in: EQUIPPABLE } },
  });
  const doomed = legacy.filter((item) => !keep.has(item.name));

  if (!doomed.length) {
    console.log('nothing to retire');
    return;
  }

  const doomedIds = doomed.map((item) => item.id);
  console.log(`${apply ? 'RETIRING' : 'would retire'} ${doomed.length} legacy items:`);
  doomed.forEach((item) => console.log(`  ${item.name} (${item.category})`));

  const owned = await prisma.inventoryItem.findMany({
    where: { itemId: { in: doomedIds } },
    include: { item: true, marketListing: true },
  });

  // What each player gets back, and what has to be unwound before the delete.
  const compensation: Record<string, number> = {};
  for (const row of owned) {
    compensation[row.userEmail] = (compensation[row.userEmail] ?? 0) + row.stack * SILVER_PER_UNIT;
  }

  const equipped = owned.filter((row) => row.equipped);
  const listed = owned.filter((row) => row.marketListing);
  const mails = await prisma.mail.findMany({ where: { itemId: { in: doomedIds } } });
  const drops = await prisma.drop.count({ where: { itemId: { in: doomedIds } } });

  console.log(
    `\ninventory rows: ${owned.length} (${equipped.length} equipped, ${listed.length} listed)\n` +
      `mail attachments: ${mails.length}\ndrop entries: ${drops}\n` +
      `players compensated: ${Object.keys(compensation).length}\n` +
      `silver paid out: ${Object.values(compensation).reduce((sum, silver) => sum + silver, 0)}`,
  );

  if (!apply) {
    console.log('\ndry run — pass --apply to write');
    return;
  }

  for (const row of equipped) {
    // Same maths the unequip path uses, so the stats come off exactly as they
    // went on, quality and enhancement included.
    const block = itemStatBlock(row);
    await prisma.stats.update({
      where: { userEmail: row.userEmail },
      data: statDelta(block, 'decrement'),
    });
  }
  console.log(`unequipped ${equipped.length} worn pieces`);

  await prisma.marketListing.deleteMany({
    where: { inventoryId: { in: listed.map((row) => row.id) } },
  });
  console.log(`cancelled ${listed.length} market listings`);

  // The mail itself is left standing — only its attachment is dropped, so the
  // message a player has not opened yet does not vanish out from under them.
  await prisma.mail.updateMany({
    where: { itemId: { in: doomedIds } },
    data: { itemId: null, itemStack: null },
  });
  console.log(`stripped ${mails.length} mail attachments`);

  await prisma.inventoryItem.deleteMany({ where: { itemId: { in: doomedIds } } });
  await prisma.drop.deleteMany({ where: { itemId: { in: doomedIds } } });
  await prisma.recipe.deleteMany({ where: { itemId: { in: doomedIds } } });
  await prisma.recipeIngredient.deleteMany({ where: { itemId: { in: doomedIds } } });
  await prisma.gatheringDrop.deleteMany({ where: { itemId: { in: doomedIds } } });
  await prisma.guildStoreProduct.deleteMany({ where: { itemId: { in: doomedIds } } });
  await prisma.storeProduct.updateMany({ where: { itemId: { in: doomedIds } }, data: { itemId: null } });
  await prisma.item.deleteMany({ where: { id: { in: doomedIds } } });
  console.log(`deleted ${doomed.length} items and everything pointing at them`);

  for (const [userEmail, silver] of Object.entries(compensation)) {
    await prisma.mail.create({
      data: {
        userEmail,
        sender: 'Poring Adventure',
        content: 'Your old equipment was retired in the gear rework. Here is silver for what you had.',
        silver,
        visualized: false,
      },
    });
  }
  console.log(`mailed compensation to ${Object.keys(compensation).length} players`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
