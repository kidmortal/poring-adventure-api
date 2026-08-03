/**
 * Every piece of equipment in the game, and which monsters drop it.
 *
 * The catalog is five tiers deep, one per map band, and each tier carries three
 * armor sets and five weapons:
 *
 *   armor   — str (heavy plate), agi (light) and int (robes), three slots each
 *   weapons — str damage, agi damage, int damage, plus a str tank line that
 *             trades attack for health and an int healer line that trades it
 *             for mana
 *
 * Stats are derived from the tier rather than typed out, so the whole curve
 * moves together. Nothing is written by hand except the asset name and which
 * line it belongs to.
 */
import { Prisma } from '@prisma/client';

import { prisma, upsertByName } from './client';

const ARMOR_FOLDER = 'https://kidmortal.sirv.com/armor';
const WEAPON_FOLDER = 'https://kidmortal.sirv.com/weapon';

/** The asset names contain spaces, which Sirv only serves percent-encoded. */
function assetUrl(folder: string, asset: string) {
  return `${folder}/${encodeURIComponent(asset)}.webp`;
}

/** "steel armor" → "Steel Armor", the name the item is known by. */
function displayName(asset: string) {
  return asset.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/**
 * One tier per map band. `requiredLevel` is the bottom of the band, so anything
 * that drops on a map can be worn by everyone who belongs on that map.
 */
const TIERS = [
  { tier: 1, requiredLevel: 1, mapName: 'Poring Forest' },
  { tier: 2, requiredLevel: 11, mapName: 'Willow Swamp' },
  { tier: 3, requiredLevel: 21, mapName: 'Cemetery' },
  { tier: 4, requiredLevel: 31, mapName: 'Scorching Desert' },
  { tier: 5, requiredLevel: 41, mapName: 'Demon Sanctuary' },
];

type ArmorLine = 'str' | 'agi' | 'int';
type WeaponLine = 'str' | 'agi' | 'int' | 'tank' | 'healer';

/** Armor assets by line and tier, in slot order: armor, legs, boots. */
const ARMOR_SETS: Record<ArmorLine, string[][]> = {
  str: [
    ['steel armor', 'knight leggings', 'leather boots'],
    ['knight armor', 'crimson greaves', 'steel boots'],
    ['crusader armor', 'dragon leggings', 'crusader boots'],
    ['dragon armor', 'magma greaves', 'dragon boots'],
    ['warlord armor', 'golden leggings', 'warlord boots'],
  ],
  agi: [
    ['green shirt', 'blue trousers', 'green boots'],
    ['forest armor', 'forest leggings', 'forest boots'],
    ['hunter coat', 'beast leggings', 'hunter boots'],
    ['shadow armor', 'coral skirt', 'shadow boots'],
    ['raider armor', 'templar skirt', 'raider boots'],
  ],
  int: [
    ['blue robe', 'blue leggings', 'blue boots'],
    ['acolyte robe', 'cleric leggings', 'acolyte boots'],
    ['cleric robe', 'sorcerer leggings', 'cleric boots'],
    ['sorcerer robe', 'jester skirt', 'sorcerer boots'],
    ['seraph robe', 'sunfire skirt', 'seraph boots'],
  ],
};

/** Weapon assets by line and tier. */
const WEAPONS: Record<WeaponLine, string[]> = {
  str: ['bronze sword', 'steel sword', 'flame longsword', 'dragon blade', 'royal greatsword'],
  agi: ['bone dagger', 'hunter dagger', 'assassin dagger', 'shadow claws', 'shadow blade'],
  int: ['wooden staff', 'goblin wand', 'emerald staff', 'flame staff', 'arcane staff'],
  tank: ['wooden club', 'stone hammer', 'bronze hammer', 'iron warhammer', 'royal warhammer'],
  healer: ['nature staff', 'water staff', 'silver staff', 'tidal staff', 'royal staff'],
};

const ARMOR_SLOTS = ['armor', 'legs', 'boots'] as const;

/**
 * How much of the tier budget each slot carries. A chest piece is worth more
 * than boots, and the primary stat is what separates the three lines: the
 * secondary stats are what makes a plate set survivable and a robe not.
 */
const SLOT_WEIGHT = { armor: 1, legs: 0.75, boots: 0.55 };

type StatBlock = { health?: number; mana?: number; attack?: number; str?: number; agi?: number; int?: number };

/**
 * Armor gives its line's stat plus health, and the robe line trades some of
 * that health for the mana a caster actually spends.
 */
function armorStats(line: ArmorLine, tier: number, slot: keyof typeof SLOT_WEIGHT): StatBlock {
  const weight = SLOT_WEIGHT[slot];
  const primary = Math.round(3 * tier * weight);
  const health = { str: 20, agi: 13, int: 8 }[line];

  return {
    [line]: primary,
    health: Math.round(health * tier * weight),
    ...(line === 'int' ? { mana: Math.round(10 * tier * weight) } : {}),
  };
}

/**
 * Damage lines are attack first; the tank trades half its attack for the health
 * to hold aggro, and the healer trades it for a deeper mana pool.
 */
function weaponStats(line: WeaponLine, tier: number): StatBlock {
  switch (line) {
    case 'str':
      return { attack: 8 * tier, str: 3 * tier };
    case 'agi':
      return { attack: 7 * tier, agi: 4 * tier };
    case 'int':
      return { attack: 6 * tier, int: 4 * tier, mana: 10 * tier };
    case 'tank':
      return { attack: 4 * tier, str: 4 * tier, health: 30 * tier };
    case 'healer':
      return { attack: 3 * tier, int: 3 * tier, mana: 25 * tier };
  }
}

export type GearSeed = {
  name: string;
  category: string;
  image: string;
  requiredLevel: number;
  tier: number;
  stats: StatBlock;
};

/** The whole catalog, built from the tables above. Used by the drop table too. */
export function gearCatalog(): GearSeed[] {
  const gear: GearSeed[] = [];

  for (const { tier, requiredLevel } of TIERS) {
    for (const line of Object.keys(ARMOR_SETS) as ArmorLine[]) {
      ARMOR_SETS[line][tier - 1].forEach((asset, slotIndex) => {
        const slot = ARMOR_SLOTS[slotIndex];
        gear.push({
          name: displayName(asset),
          category: slot,
          image: assetUrl(ARMOR_FOLDER, asset),
          requiredLevel,
          tier,
          stats: armorStats(line, tier, slot),
        });
      });
    }

    for (const line of Object.keys(WEAPONS) as WeaponLine[]) {
      const asset = WEAPONS[line][tier - 1];
      gear.push({
        name: displayName(asset),
        category: 'weapon',
        image: assetUrl(WEAPON_FOLDER, asset),
        requiredLevel,
        tier,
        stats: weaponStats(line, tier),
      });
    }
  }

  return gear;
}

export async function seedEquipment() {
  const gear = gearCatalog();

  for (const piece of gear) {
    await upsertByName<Prisma.ItemUncheckedCreateInput>(prisma.item, {
      name: piece.name,
      category: piece.category,
      image: piece.image,
      requiredLevel: piece.requiredLevel,
      // Every stat is written, so a piece that loses one has it cleared rather
      // than silently keeping the old value.
      attack: piece.stats.attack ?? null,
      str: piece.stats.str ?? null,
      agi: piece.stats.agi ?? null,
      int: piece.stats.int ?? null,
      health: piece.stats.health ?? null,
      mana: piece.stats.mana ?? null,
    });
  }

  console.log(`equipment: ${gear.length} pieces across ${TIERS.length} tiers`);
}

/**
 * Gear drops from the map its tier belongs to, and only from there. Rates are
 * deliberately low — armor is spread across the map's ordinary monsters, while
 * the five weapons hang off the boss and the toughest normal monster, which are
 * the two the party has to work for.
 */
export async function seedEquipmentDrops() {
  const gear = gearCatalog();
  let dropCount = 0;

  for (const { tier, mapName } of TIERS) {
    const map = await prisma.map.findFirst({
      where: { name: mapName },
      include: { monster: true },
    });
    if (!map) throw new Error(`no map named "${mapName}" — seed monsters first`);

    const tierGear = gear.filter((piece) => piece.tier === tier);
    const monsters = [...map.monster].sort((a, b) => a.level - b.level);
    const boss = monsters.find((monster) => monster.boss) ?? monsters[monsters.length - 1];
    const normals = monsters.filter((monster) => monster.id !== boss.id);
    // The hardest ordinary monster shares the weapon table with the boss.
    const weaponHolders = [boss, normals[normals.length - 1]].filter(Boolean);

    for (const piece of tierGear) {
      const item = await prisma.item.findFirst({ where: { name: piece.name } });
      if (!item) throw new Error(`no item named "${piece.name}" — seed equipment first`);

      // Boots are the most common find, weapons the rarest.
      const chance = { weapon: 5, armor: 8, legs: 9, boots: 10 }[piece.category] ?? 8;
      const holders =
        piece.category === 'weapon'
          ? [weaponHolders[dropCount % weaponHolders.length]]
          : [normals[dropCount % normals.length]];

      for (const monster of holders) {
        const data = { monsterId: monster.id, itemId: item.id, chance, minAmount: 1, maxAmount: 1 };
        await prisma.drop.upsert({
          where: { monsterId_itemId: { monsterId: monster.id, itemId: item.id } },
          create: data,
          update: data,
        });
      }
      dropCount++;
    }
  }

  console.log(`equipment drops: ${dropCount} placed at 5-10%`);
}
