/**
 * One-off cleanup for the consumable rework: removes the food, potions and
 * materials the new catalog no longer names, and pays players back for what
 * they were holding.
 *
 *   npx ts-node -r tsconfig-paths/register src/core/prisma/retireLegacyConsumables.ts          # dry run
 *   npx ts-node -r tsconfig-paths/register src/core/prisma/retireLegacyConsumables.ts --apply  # writes
 *
 * The seed never deletes, so every item pulled out of a seed file is still
 * sitting in the database pointing at artwork that was never uploaded — a row
 * of broken images in the inventory. This is the other half of that: the seed
 * writes what should exist, and this removes what should not.
 *
 * Nothing here is equipped, so unlike the gear retirement there are no stats to
 * unwind. Listings, mail attachments and loot tables still have to be cleared
 * before the item row can go.
 *
 * Prints exactly what it would do and changes nothing unless `--apply` is
 * passed. Point TURSO_DATABASE_URL at the deployed database to run it there.
 */
import { prisma } from './seed/client';
import { seededConsumableAndMaterialNames } from './seed/items';
import { seededNodeNames, seededRecipeNames } from './seed/professions';

/** Paid per unit held. Consumables are cheap; this is a gesture, not a refund. */
const SILVER_PER_UNIT = 20;

const apply = process.argv.includes('--apply');

async function main() {
  const keep = new Set(seededConsumableAndMaterialNames());
  const existing = await prisma.item.findMany({
    where: { category: { in: ['consumable', 'material'] } },
  });
  const doomed = existing.filter((item) => !keep.has(item.name));

  // Nodes and recipes are checked even when no item is doomed: a previous run
  // may have retired the items and left the work that pointed at them standing.
  if (!doomed.length) {
    console.log('no legacy items to retire');
    await retireOrphanedWork();
    if (!apply) console.log('\ndry run — pass --apply to write');
    return;
  }

  const doomedIds = doomed.map((item) => item.id);
  console.log(`${apply ? 'RETIRING' : 'would retire'} ${doomed.length} legacy items:`);
  doomed.forEach((item) => console.log(`  ${item.name} (${item.category})`));

  const owned = await prisma.inventoryItem.findMany({
    where: { itemId: { in: doomedIds } },
    include: { marketListing: true },
  });

  const compensation: Record<string, number> = {};
  for (const row of owned) {
    compensation[row.userEmail] = (compensation[row.userEmail] ?? 0) + row.stack * SILVER_PER_UNIT;
  }

  const listed = owned.filter((row) => row.marketListing);
  const mails = await prisma.mail.findMany({ where: { itemId: { in: doomedIds } } });
  const drops = await prisma.drop.count({ where: { itemId: { in: doomedIds } } });
  const gathers = await prisma.gatheringDrop.count({ where: { itemId: { in: doomedIds } } });
  const commissions = await prisma.commission.count({ where: { itemId: { in: doomedIds } } });

  console.log(
    `\ninventory rows: ${owned.length} (${listed.length} listed)\n` +
      `mail attachments: ${mails.length}\ndrop entries: ${drops}\n` +
      `gathering drops: ${gathers}\ncommissions: ${commissions}\n` +
      `players compensated: ${Object.keys(compensation).length}\n` +
      `silver paid out: ${Object.values(compensation).reduce((sum, silver) => sum + silver, 0)}`,
  );

  if (!apply) {
    await retireOrphanedWork();
    console.log('\ndry run — pass --apply to write');
    return;
  }

  await prisma.marketListing.deleteMany({
    where: { inventoryId: { in: listed.map((row) => row.id) } },
  });
  console.log(`cancelled ${listed.length} market listings`);

  // The mail itself is left standing — only its attachment is dropped, so a
  // message a player has not opened yet does not vanish out from under them.
  await prisma.mail.updateMany({
    where: { itemId: { in: doomedIds } },
    data: { itemId: null, itemStack: null },
  });
  console.log(`stripped ${mails.length} mail attachments`);

  await prisma.inventoryItem.deleteMany({ where: { itemId: { in: doomedIds } } });
  await prisma.drop.deleteMany({ where: { itemId: { in: doomedIds } } });
  await prisma.gatheringDrop.deleteMany({ where: { itemId: { in: doomedIds } } });
  await prisma.commission.deleteMany({ where: { itemId: { in: doomedIds } } });
  await prisma.recipeIngredient.deleteMany({ where: { itemId: { in: doomedIds } } });
  await prisma.recipe.deleteMany({ where: { itemId: { in: doomedIds } } });
  await prisma.guildStoreProduct.deleteMany({ where: { itemId: { in: doomedIds } } });
  await prisma.storeProduct.updateMany({ where: { itemId: { in: doomedIds } }, data: { itemId: null } });
  await prisma.item.deleteMany({ where: { id: { in: doomedIds } } });
  console.log(`deleted ${doomed.length} items and everything pointing at them`);

  for (const [userEmail, silver] of Object.entries(compensation)) {
    await prisma.mail.create({
      data: {
        userEmail,
        sender: 'Poring Adventure',
        content: 'The kitchens and workshops were reorganised. Here is silver for the supplies you were holding.',
        silver,
        visualized: false,
      },
    });
  }
  console.log(`mailed compensation to ${Object.keys(compensation).length} players`);

  await retireOrphanedWork();
}

/**
 * Nodes and recipes the catalog no longer names.
 *
 * Retiring an item takes its drops and ingredients with it, which can leave a
 * node standing with an empty table — it costs stamina and returns nothing —
 * or a recipe that asks for nothing and makes nothing. Neither is something a
 * player should be able to find.
 */
async function retireOrphanedWork() {
  const keptNodes = new Set(seededNodeNames());
  const keptRecipes = new Set(seededRecipeNames());

  const nodes = (await prisma.gatheringNode.findMany()).filter((node) => !keptNodes.has(node.name));
  const recipes = (await prisma.recipe.findMany()).filter((recipe) => !keptRecipes.has(recipe.name));

  if (nodes.length) {
    console.log(`\n${apply ? 'retiring' : 'would retire'} ${nodes.length} orphaned nodes:`);
    nodes.forEach((node) => console.log(`  ${node.name}`));
    const ids = nodes.map((node) => node.id);
    if (apply) {
      await prisma.gatheringDrop.deleteMany({ where: { nodeId: { in: ids } } });
      await prisma.gatheringNode.deleteMany({ where: { id: { in: ids } } });
    }
  }

  if (recipes.length) {
    console.log(`\n${apply ? 'retiring' : 'would retire'} ${recipes.length} orphaned recipes:`);
    recipes.forEach((recipe) => console.log(`  ${recipe.name}`));
    const ids = recipes.map((recipe) => recipe.id);
    if (apply) {
      await prisma.recipeIngredient.deleteMany({ where: { recipeId: { in: ids } } });
      await prisma.recipe.deleteMany({ where: { id: { in: ids } } });
    }
  }

  if (!nodes.length && !recipes.length) {
    console.log('\nno orphaned nodes or recipes');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
