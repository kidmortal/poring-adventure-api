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
import { backfillDefense, seedBuffs, seedClasses, seedDebuffs, seedHeads, seedSkills } from './characters';
import { pruneProfessionDrops, seedMonsters } from './monsters';
import { seedGatheringNodes, seedProfessions, seedRecipes } from './professions';
import { seedCommissions } from './commissions';
import { seedGuildBosses, seedGuildStore, seedGuildTasks } from './guild';
import { seedStoreProducts } from './store';

/**
 * Order matters: everything below items resolves an item by name, and buffs
 * come before items because a meal points at the buff eating it grants.
 */
const STEPS = [
  seedBuffs,
  seedItems,
  seedEquipment,
  seedHeads,
  seedClasses,
  // The one step that touches player rows: defense is newer than the characters
  // holding it, and is derived entirely from the class blocks seeded above.
  backfillDefense,
  // Both come before the skills that point at them.
  seedDebuffs,
  seedSkills,
  seedMonsters,
  // Needs both the gear and the monsters that drop it.
  seedEquipmentDrops,
  seedProfessions,
  seedGatheringNodes,
  seedRecipes,
  // Needs both: it reads the nodes and recipes to know what a monster must not drop.
  pruneProfessionDrops,
  // Needs both the professions and everything they can be asked to hand over.
  seedCommissions,
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
