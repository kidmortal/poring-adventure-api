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
  /** The buff eating it grants, by name. Cooking's entire output. */
  buffName?: string;
  /** Usable mid-fight, at the cost of a turn. Alchemy's entire output. */
  battleUse?: boolean;
  /** Feeds the whole party rather than the one who ate it. */
  partyWide?: boolean;
  /** An action rather than a restore — currently only "escape". */
  battleEffect?: string;
};

const ITEMS: ItemSeed[] = [
  // Drops and store stock. These predate the professions and stay as they are:
  // small top-ups nobody has to craft.
  { name: 'Slice of Cake', category: 'consumable', image: `${CONSUMABLES}/slice_of_cake.webp`, health: 10, mana: 5 },
  { name: 'Bread', category: 'consumable', image: `${CONSUMABLES}/bread.webp`, health: 10, mana: 10 },
  { name: 'Small Health Potion', category: 'consumable', image: `${CONSUMABLES}/small_health_potion.webp`, health: 20 },
  {
    name: 'Large Health Potion',
    category: 'consumable',
    image: `${CONSUMABLES}/large_health_potion.webp`,
    health: 100,
  },
  { name: 'Large Mana Potion', category: 'consumable', image: `${CONSUMABLES}/large_mana_potion.webp`, mana: 100 },

  // Cooking. Meals buff and no longer heal: healing was Alchemy's job done
  // worse, which left no reason to be a cook and therefore none to be a
  // fisherman. A buff expires, so the demand for food comes back every day.
  {
    name: 'Grilled Fish',
    category: 'consumable',
    image: `${CONSUMABLES}/grilled_fish.webp`,
    buffName: 'Well Fed',
  },
  {
    name: 'Herb Stew',
    category: 'consumable',
    image: `${CONSUMABLES}/herb_stew.webp`,
    buffName: 'Hearty',
  },
  {
    name: 'Spiced Roast',
    category: 'consumable',
    image: `${CONSUMABLES}/spiced_roast.webp`,
    buffName: 'Spiced',
  },
  /** The reason a party brings a cook rather than everyone cooking for themselves. */
  {
    name: 'Feast Platter',
    category: 'consumable',
    image: `${CONSUMABLES}/feast_platter.webp`,
    buffName: 'Feasted',
    partyWide: true,
  },

  // Alchemy. Everything here works mid-fight, which is the trade against a
  // Priest: silver instead of a party slot, and it costs you the turn.
  {
    name: 'Healing Potion',
    category: 'consumable',
    image: `${CONSUMABLES}/healing_potion.webp`,
    health: 50,
    battleUse: true,
  },
  {
    name: 'Mana Potion',
    category: 'consumable',
    image: `${CONSUMABLES}/mana_potion.webp`,
    mana: 50,
    battleUse: true,
  },
  {
    name: 'Revive Draught',
    category: 'consumable',
    image: `${CONSUMABLES}/revive_draught.webp`,
    buffName: 'Second Wind',
    battleUse: true,
  },
  {
    name: 'Escape Powder',
    category: 'consumable',
    image: `${CONSUMABLES}/escape_powder.webp`,
    battleUse: true,
    battleEffect: 'escape',
  },

  // Gathering materials, one band at a time. Each map's monsters drop the band's
  // materials too, which is the bridge between the two economies: fighters farm
  // what they cannot use and sell it to crafters who cannot fight.
  { name: 'Copper Ore', category: 'material', image: `${MATERIALS}/copper_ore.webp` },
  { name: 'Iron Ore', category: 'material', image: `${MATERIALS}/iron_ore.webp` },
  { name: 'Silver Ore', category: 'material', image: `${MATERIALS}/silver_ore.webp` },
  { name: 'Gold Ore', category: 'material', image: `${MATERIALS}/gold_ore.webp` },
  { name: 'Demon Ore', category: 'material', image: `${MATERIALS}/demon_ore.webp` },

  { name: 'Raw Fish', category: 'material', image: `${MATERIALS}/raw_fish.webp` },
  { name: 'Fish Scale', category: 'material', image: `${MATERIALS}/fish_scale.webp` },
  { name: 'Swamp Reed', category: 'material', image: `${MATERIALS}/swamp_reed.webp` },
  { name: 'Grave Moss', category: 'material', image: `${MATERIALS}/grave_moss.webp` },

  { name: 'Green Herb', category: 'material', image: `${MATERIALS}/green_herb.webp` },
  { name: 'Blue Herb', category: 'material', image: `${MATERIALS}/blue_herb.webp` },
  { name: 'Sun Blossom', category: 'material', image: `${MATERIALS}/sun_blossom.webp` },
  { name: 'Void Bloom', category: 'material', image: `${MATERIALS}/void_bloom.webp` },
];

export async function seedItems() {
  for (const item of ITEMS) {
    // The optional stat columns are nullable, so an item that loses a stat has
    // to be told to clear it rather than simply leaving the key out. Grilled
    // Fish depends on this: it used to heal 30 and now buffs instead, and only
    // an explicit null takes the old healing away on a re-seed.
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
      buffId: item.buffName ? await buffIdByName(item.buffName) : null,
      battleUse: item.battleUse ?? false,
      partyWide: item.partyWide ?? false,
      battleEffect: item.battleEffect ?? null,
    });
  }
  console.log(`items: ${ITEMS.length}`);
}

async function buffIdByName(name: string) {
  const buff = await prisma.buff.findUnique({ where: { name } });
  if (!buff) throw new Error(`no buff named "${name}" — seed buffs first`);
  return buff.id;
}
