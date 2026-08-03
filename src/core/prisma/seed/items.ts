/**
 * Consumables and materials. Nothing else can be seeded before this: drops,
 * recipes, gathering nodes, commissions and both stores all point at an item by
 * name.
 *
 * Equipment lives in `equipment.ts` instead — it is generated from a tier
 * table rather than listed piece by piece.
 *
 * Every image goes through the helpers in `assets.ts`, which refuse a file name
 * that was never uploaded. Do not inline a URL here.
 */
import { Prisma } from '@prisma/client';

import { prisma, upsertByName } from './client';
import { ConsumableAsset, MaterialAsset, consumableImage, materialImage } from './assets';

type ItemSeed = {
  name: string;
  category: string;
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

type MaterialSeed = ItemSeed & { asset: MaterialAsset };
type ConsumableSeed = ItemSeed & { asset: ConsumableAsset };

/**
 * Raw goods, in the five bands the maps and the gear already use. Each
 * gathering trade owns a line, and each line has a material per band so a
 * gatherer always has a next thing to unlock rather than working the same two
 * nodes from level one to fifty.
 *
 * The fourth group is different: those are not gathered at all. They drop off
 * monsters, which is the bridge between the two economies — a fighter farms
 * what they have no profession to use and sells it to a crafter who cannot go
 * and get it themselves.
 */
const MATERIALS: MaterialSeed[] = [
  // Mining — ore, stone and crystal. Feeds the blacksmith.
  { name: 'Copper Ore', asset: 'copper_ore', category: 'material' },
  { name: 'Stone Chunk', asset: 'stone chunk', category: 'material' },
  { name: 'Iron Ore', asset: 'iron_ore', category: 'material' },
  { name: 'Silver Ore', asset: 'silver ore', category: 'material' },
  { name: 'Jade Ore', asset: 'jade ore', category: 'material' },
  { name: 'Crystal Cluster', asset: 'crystal cluster', category: 'material' },
  { name: 'Gold Dust', asset: 'gold_dust', category: 'material' },
  { name: 'Fire Crystal', asset: 'fire crystal', category: 'material' },
  { name: 'Dark Ore', asset: 'dark ore', category: 'material' },
  { name: 'Prism Gem', asset: 'prism_gem', category: 'material' },

  // Fishing — fish and what washes up with them. Feeds the cook.
  { name: 'Raw Fish', asset: 'raw_fish', category: 'material' },
  { name: 'Pink Shell', asset: 'pink shell', category: 'material' },
  { name: 'Dried Fish', asset: 'dried_fish', category: 'material' },
  { name: 'Blue Shell', asset: 'blue shell', category: 'material' },
  { name: 'Salmon Fillet', asset: 'salmon_fillet', category: 'material' },
  { name: 'Seaweed', asset: 'seaweed', category: 'material' },
  { name: 'Tuna Fish', asset: 'tuna_fish', category: 'material' },
  { name: 'Crab Legs', asset: 'crab_legs', category: 'material' },
  { name: 'Raw Shrimp', asset: 'raw_shrimp', category: 'material' },
  { name: 'White Coral', asset: 'white coral', category: 'material' },

  // Herbalism — herbs for the alchemist, and the produce the cook needs to make
  // a meal out of a fish. One trade feeds two, which is why its nodes are the
  // busiest table in the game.
  { name: 'Green Herb', asset: 'green_herb', category: 'material' },
  { name: 'Herb Leaf', asset: 'herb_leaf', category: 'material' },
  { name: 'Wheat Bundle', asset: 'wheat_bundle', category: 'material' },
  { name: 'Blue Herb', asset: 'blue_herb', category: 'material' },
  { name: 'Mushroom', asset: 'mushroom', category: 'material' },
  { name: 'Carrot', asset: 'carrot', category: 'material' },
  { name: 'Clover Herb', asset: 'clover_herb', category: 'material' },
  { name: 'Ginseng Root', asset: 'ginseng_root', category: 'material' },
  { name: 'Rice Barrel', asset: 'rice_barrel', category: 'material' },
  { name: 'Azure Herb', asset: 'azure_herb', category: 'material' },
  { name: 'Moon Blossom', asset: 'moon_blossom', category: 'material' },
  { name: 'Spice Pouch', asset: 'spice_pouch_red', category: 'material' },
  { name: 'Dragon Herb', asset: 'dragon_herb', category: 'material' },
  { name: 'Fairy Essence', asset: 'fairy_essence', category: 'material' },
  { name: 'Four Leaf Clover', asset: 'four_leaf_clover', category: 'material' },

  // Monster parts. Not on any node — these only come off the thing that was
  // wearing them, so a cook who wants meat has to fight for it or buy it.
  { name: 'Slime Jelly', asset: 'slime_jelly_red', category: 'material' },
  { name: 'Worm', asset: 'worm', category: 'material' },
  { name: 'Raw Meat', asset: 'raw_meat', category: 'material' },
  { name: 'Serpent Tail', asset: 'serpent_tail', category: 'material' },
  { name: 'Beetle', asset: 'beetle', category: 'material' },
  { name: 'Bone Fragment', asset: 'bone_fragment', category: 'material' },
  { name: 'Bat Wing', asset: 'bat_wing', category: 'material' },
  { name: 'Shadow Orb', asset: 'shadow_orb', category: 'material' },
  { name: 'Beast Claw', asset: 'beast_claw', category: 'material' },
  { name: 'Poison Pouch', asset: 'poison pouch', category: 'material' },
  { name: 'Ivory Horn', asset: 'ivory horn', category: 'material' },
  { name: 'Phoenix Feather', asset: 'phoenix feather', category: 'material' },
  { name: 'Crystal Heart', asset: 'crystal_heart', category: 'material' },
  { name: 'Dark Wing', asset: 'dark_wing', category: 'material' },
  { name: 'Egg', asset: 'egg', category: 'material' },
  { name: 'Honey Pot', asset: 'honey_pot', category: 'material' },
  { name: 'Cheese Wedge', asset: 'cheese_wedge', category: 'material' },
];

/**
 * Everything a player can eat or drink.
 *
 * The two crafting trades own different verbs, which is the whole reason both
 * exist. Alchemy restores, in the middle of a fight, at the cost of a turn.
 * Cooking buffs, before one, and its buffs tick down per battle so the demand
 * for food comes back tomorrow. Neither can do the other's job.
 */
const CONSUMABLES: ConsumableSeed[] = [
  // ---------------------------------------------------------------- Alchemy
  // Health, in five tiers. This is the line that makes a party without a Priest
  // viable: worse than one, on purpose, and paid for in silver and tempo.
  { name: 'Minor Health Potion', asset: 'potion_health_small', category: 'consumable', health: 40, battleUse: true },
  { name: 'Health Potion', asset: 'vial_health', category: 'consumable', health: 90, battleUse: true },
  {
    name: 'Greater Health Potion',
    asset: 'elixir_bottle_health',
    category: 'consumable',
    health: 180,
    battleUse: true,
  },
  { name: 'Grand Health Flask', asset: 'grand_flask_health', category: 'consumable', health: 330, battleUse: true },
  { name: 'Sovereign Elixir', asset: 'ornate_gold_elixir', category: 'consumable', health: 600, battleUse: true },

  // Mana, in four. One tier shorter than health because running dry is a slower
  // problem than dying is.
  { name: 'Minor Mana Potion', asset: 'potion_mana_small', category: 'consumable', mana: 40, battleUse: true },
  { name: 'Mana Potion', asset: 'vial_mana', category: 'consumable', mana: 90, battleUse: true },
  { name: 'Greater Mana Potion', asset: 'elixir_bottle_mana', category: 'consumable', mana: 180, battleUse: true },
  { name: 'Grand Mana Flask', asset: 'grand_flask_mana', category: 'consumable', mana: 330, battleUse: true },

  // A little of both, for the classes that want neither in particular.
  { name: 'Cyan Elixir', asset: 'elixir_bottle_cyan', category: 'consumable', health: 150, mana: 150, battleUse: true },

  // The utility line — the things a Priest cannot do at any level.
  {
    name: 'Smoke Bomb',
    asset: 'smoke_potion',
    category: 'consumable',
    battleUse: true,
    battleEffect: 'escape',
  },
  {
    name: 'Phoenix Draught',
    asset: 'golden_potion',
    category: 'consumable',
    buffName: 'Second Wind',
    battleUse: true,
  },

  // ---------------------------------------------------------------- Cooking
  // Snacks restore and nothing else. They are the cheap tier a level-one cook
  // can actually sell, and what the old drop tables hand out.
  { name: 'Bread Bun', asset: 'bread_bun', category: 'consumable', health: 30 },
  { name: 'Rice Bowl', asset: 'rice_bowl', category: 'consumable', health: 30, mana: 20 },
  { name: 'Round Cookie', asset: 'round_cookie', category: 'consumable', health: 20, mana: 20 },
  { name: 'White Tea', asset: 'white_tea_cup', category: 'consumable', mana: 50 },
  { name: 'Strawberry Cake', asset: 'strawberry_cake', category: 'consumable', health: 60, mana: 60 },

  // The attack line. Every tier is the same idea hitting harder for longer.
  { name: 'Grilled Fish', asset: 'grilled_fish', category: 'consumable', buffName: 'Well Fed' },
  { name: 'Grilled Skewer', asset: 'grilled_skewer', category: 'consumable', buffName: 'Well Fed II' },
  { name: 'Roast Meat', asset: 'roast_meat', category: 'consumable', buffName: 'Well Fed III' },
  { name: 'Glazed Ham', asset: 'glazed_ham', category: 'consumable', buffName: 'Well Fed IV' },

  // The staying-power line. Reads as damage reduction rather than a bigger
  // health pool, because a mid-fight change to maxHealth would have to be
  // unwound when it expired.
  { name: 'Soup Bowl', asset: 'soup_bowl', category: 'consumable', buffName: 'Hearty' },
  { name: 'Stew Bowl', asset: 'stew_bowl', category: 'consumable', buffName: 'Hearty II' },
  { name: 'Curry Bowl', asset: 'curry_bowl', category: 'consumable', buffName: 'Hearty III' },
  { name: 'Monster Stew', asset: 'monster_stew', category: 'consumable', buffName: 'Hearty IV' },

  // Balanced meals: less of each than the specialists, and worth more than both
  // to anyone who does not know what they are walking into.
  { name: 'Sushi Roll', asset: 'sushi_roll', category: 'consumable', buffName: 'Balanced' },
  { name: 'Pasta Dish', asset: 'pasta_dish', category: 'consumable', buffName: 'Balanced II' },
  { name: 'Seafood Pasta', asset: 'seafood_pasta', category: 'consumable', buffName: 'Balanced III' },

  // Platters feed the party. One craft, everybody buffed — the reason a group
  // brings a cook rather than each member cooking for themselves.
  { name: 'Fruit Platter', asset: 'fruit_platter', category: 'consumable', buffName: 'Feasted', partyWide: true },
  {
    name: 'Grilled Platter',
    asset: 'grilled_platter',
    category: 'consumable',
    buffName: 'Feasted II',
    partyWide: true,
  },
  { name: 'Sushi Platter', asset: 'sushi_platter', category: 'consumable', buffName: 'Feasted III', partyWide: true },
];

/**
 * Every consumable and material the catalog names. `retireLegacyConsumables`
 * reads this to work out what is left over from an older roster — the seed
 * never deletes, so removing an item here is only half of removing it.
 */
export function seededConsumableAndMaterialNames() {
  return [...MATERIALS, ...CONSUMABLES].map((item) => item.name);
}

export async function seedItems() {
  for (const item of [...MATERIALS, ...CONSUMABLES]) {
    const image =
      item.category === 'material'
        ? materialImage(item.asset as MaterialAsset)
        : consumableImage(item.asset as ConsumableAsset);

    // The optional columns are nullable, so an item that loses one has to be
    // told to clear it rather than simply leaving the key out. The meal line
    // depends on this: Grilled Fish used to heal 30 and now only buffs, and
    // only an explicit null takes the old healing away on a re-seed.
    await upsertByName<Prisma.ItemUncheckedCreateInput>(prisma.item, {
      name: item.name,
      category: item.category,
      image,
      attack: null,
      str: null,
      agi: null,
      int: null,
      health: item.health ?? null,
      mana: item.mana ?? null,
      buffId: item.buffName ? await buffIdByName(item.buffName) : null,
      battleUse: item.battleUse ?? false,
      partyWide: item.partyWide ?? false,
      battleEffect: item.battleEffect ?? null,
    });
  }
  console.log(`items: ${MATERIALS.length} materials, ${CONSUMABLES.length} consumables`);
}

async function buffIdByName(name: string) {
  const buff = await prisma.buff.findUnique({ where: { name } });
  if (!buff) throw new Error(`no buff named "${name}" — seed buffs first`);
  return buff.id;
}
