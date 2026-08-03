/**
 * Consumables and materials. Nothing else can be seeded before this: drops,
 * recipes, gathering nodes and both stores all point at an item by name.
 *
 * Equipment lives in `equipment.ts` instead — it is generated from a tier
 * table rather than listed piece by piece.
 */
import { Prisma } from '@prisma/client';

import { prisma, upsertByName } from './client';

const CONSUMABLES = 'https://kidmortal.sirv.com/consumables';
const MATERIALS = 'https://kidmortal.sirv.com/materials';

type ItemSeed = {
  name: string;
  category: string;
  image: string;
  attack?: number;
  str?: number;
  agi?: number;
  int?: number;
  health?: number;
  mana?: number;
};

const ITEMS: ItemSeed[] = [
  // Consumables
  { name: 'Slice of Cake', category: 'consumable', image: `${CONSUMABLES}/slice_of_cake.webp`, health: 10, mana: 5 },
  { name: 'Bread', category: 'consumable', image: `${CONSUMABLES}/bread.webp`, health: 10, mana: 10 },
  { name: 'Small Health Potion', category: 'consumable', image: `${CONSUMABLES}/small_health_potion.webp`, health: 20 },
  { name: 'Large Health Potion', category: 'consumable', image: `${CONSUMABLES}/large_health_potion.webp`, health: 100 },
  { name: 'Large Mana Potion', category: 'consumable', image: `${CONSUMABLES}/large_mana_potion.webp`, mana: 100 },
  { name: 'Grilled Fish', category: 'consumable', image: `${CONSUMABLES}/grilled_fish.webp`, health: 30 },
  { name: 'Healing Potion', category: 'consumable', image: `${CONSUMABLES}/healing_potion.webp`, health: 50 },
  { name: 'Mana Potion', category: 'consumable', image: `${CONSUMABLES}/mana_potion.webp`, mana: 50 },

  // Gathering materials
  { name: 'Copper Ore', category: 'material', image: `${MATERIALS}/copper_ore.webp` },
  { name: 'Iron Ore', category: 'material', image: `${MATERIALS}/iron_ore.webp` },
  { name: 'Raw Fish', category: 'material', image: `${MATERIALS}/raw_fish.webp` },
  { name: 'Fish Scale', category: 'material', image: `${MATERIALS}/fish_scale.webp` },
  { name: 'Green Herb', category: 'material', image: `${MATERIALS}/green_herb.webp` },
  { name: 'Blue Herb', category: 'material', image: `${MATERIALS}/blue_herb.webp` },
];

export async function seedItems() {
  for (const item of ITEMS) {
    // The optional stat columns are nullable, so an item that loses a stat has
    // to be told to clear it rather than simply leaving the key out.
    await upsertByName<Prisma.ItemUncheckedCreateInput>(prisma.item, {
      name: item.name,
      category: item.category,
      image: item.image,
      attack: item.attack ?? null,
      str: item.str ?? null,
      agi: item.agi ?? null,
      int: item.int ?? null,
      health: item.health ?? null,
      mana: item.mana ?? null,
    });
  }
  console.log(`items: ${ITEMS.length}`);
}
