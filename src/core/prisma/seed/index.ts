/**
 * Seeds every fixed table — the content the game is made of, as opposed to what
 * players make of it. Users, stats, inventories, parties, guilds, mail,
 * purchases and the rest of the per-player tables are never touched.
 *
 *   yarn seed                 # local dev.db
 *   TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… yarn seed    # the deployed database
 *
 * It is idempotent: rows are matched by their natural key, so running it again
 * refreshes the numbers on what is already there and creates only what is
 * missing. It never deletes, so content pulled out of a seed file still has to
 * be removed by hand.
 */
import { prisma } from './client';
import { seedItems } from './items';
import { seedEquipment, seedEquipmentDrops } from './equipment';
import { seedBuffs, seedClasses, seedHeads, seedSkills } from './characters';
import { seedMonsters } from './monsters';
import { seedGatheringNodes, seedProfessions, seedRecipes } from './professions';
import { seedGuildBosses, seedGuildStore, seedGuildTasks } from './guild';
import { seedStoreProducts } from './store';

/** Order matters: everything below items resolves an item by name. */
const STEPS = [
  seedItems,
  seedEquipment,
  seedHeads,
  seedClasses,
  seedBuffs,
  seedSkills,
  seedMonsters,
  // Needs both the gear and the monsters that drop it.
  seedEquipmentDrops,
  seedProfessions,
  seedGatheringNodes,
  seedRecipes,
  seedGuildTasks,
  seedGuildBosses,
  seedGuildStore,
  seedStoreProducts,
];

async function main() {
  for (const step of STEPS) {
    await step();
  }
  console.log('seed complete');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
