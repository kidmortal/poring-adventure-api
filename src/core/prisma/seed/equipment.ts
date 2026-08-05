/**
 * Every piece of equipment in the game, and which monsters drop it.
 *
 * The catalog is five tiers deep, one per map band, and each tier carries three
 * armor sets, five weapons and four accessories:
 *
 *   armor      — str (heavy plate), agi (light) and int (robes), three slots each
 *   weapons    — str damage, agi damage, int damage, plus a str tank line that
 *                trades attack for health and an int healer line that trades it
 *                for mana
 *   accessory  — one per line: crit, mana, health, defense. The top three tiers
 *                carry a second, stronger version of each that only drops in
 *                that band's dungeon
 *
 * A piece's `grade` is where it is found: `map` gear goes in the map drop tables
 * below, `dungeon` gear is claimed by `dungeons.ts` and appears nowhere else.
 *
 * Stats are derived from the tier rather than typed out, so the whole curve
 * moves together. Nothing is written by hand except the asset name and which
 * line it belongs to.
 */
import { Prisma } from '@prisma/client';

import { prisma, upsertByName } from './client';

const ARMOR_FOLDER = 'https://kidmortal.sirv.com/armor';
const WEAPON_FOLDER = 'https://kidmortal.sirv.com/weapon';
const ACCESSORY_FOLDER = 'https://kidmortal.sirv.com/accessory';

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
type AccessoryLine = 'crit' | 'mana' | 'health' | 'defense';

/** Where a piece is found, which is also how hard it hits for its level. */
type Grade = 'map' | 'dungeon';

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
 * The accessory slot is the one that answers "what does my class actually
 * want": crit for whoever is doing the damage, mana for whoever is spending it,
 * health and defense for whoever is being hit. Armour is chosen by line and
 * weapons by class, so this is the only slot where all four classes are
 * shopping in the same list — which is why there is one of each per tier rather
 * than a single line everyone wears.
 *
 * One asset per tier per line, in tier order.
 */
const ACCESSORIES: Record<AccessoryLine, string[]> = {
  crit: ['onyx ring', 'amber ring', 'topaz ring', 'emerald ring', 'sapphire ring'],
  mana: ['star charm', 'arcane charm', 'purple banner', 'gold wings', 'angel wings'],
  health: ['leather pouch', 'orange pack', 'adventurer pack', 'traveler pack', 'bear cub'],
  defense: ['red banner', 'gold belt', 'gold necklace', 'flame emblem', 'sun crest'],
};

/**
 * The dungeon set. One piece per line per dungeon tier, at the same level as the
 * map accessory it sits beside and worth roughly twice as much — a dungeon is
 * one attempt a day, so what it drops has to be worth the day.
 *
 * All three tiers of a line share one asset on purpose: they read as a set, the
 * way the map lines read as a progression, and the name says which floor it came
 * off. Dungeons only exist on the top three bands, so tiers 1-2 have none.
 */
const DUNGEON_ACCESSORY_ASSET: Record<AccessoryLine, string> = {
  crit: 'ruby ring',
  mana: 'gold wings 2',
  health: 'hunting horn',
  defense: 'diamond ring',
};

/** What the piece is called, by the dungeon band it drops on. */
const DUNGEON_TIER_PREFIX: Record<number, string> = { 3: 'crypt', 4: 'tomb', 5: 'sanctum' };
const DUNGEON_LINE_NOUN: Record<AccessoryLine, string> = {
  crit: 'ring',
  mana: 'charm',
  health: 'talisman',
  defense: 'seal',
};

/**
 * How much of the tier budget each slot carries. A chest piece is worth more
 * than boots, and the primary stat is what separates the three lines: the
 * secondary stats are what makes a plate set survivable and a robe not.
 */
const SLOT_WEIGHT = { armor: 1, legs: 0.75, boots: 0.55 };

type StatBlock = {
  health?: number;
  mana?: number;
  attack?: number;
  str?: number;
  agi?: number;
  int?: number;
  defense?: number;
  critRate?: number;
  critDamage?: number;
};

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

/**
 * A map accessory is one stat, cleanly: the slot is a choice about what your
 * class needs, and a piece that gave a little of everything would make that
 * choice for you. The tier 5 crit ring is +10%, which takes a character from 5%
 * to 15% — often enough to feel, never often enough to plan a turn around.
 *
 * The dungeon version is twice that plus a second stat, at the same required
 * level. That is the trade the whole dungeon is built on: a map can be farmed
 * all afternoon, a dungeon is one attempt a day, so it pays properly.
 */
function accessoryStats(line: AccessoryLine, tier: number, grade: Grade): StatBlock {
  if (grade === 'map') {
    switch (line) {
      case 'crit':
        return { critRate: 2 * tier };
      case 'mana':
        return { mana: 15 * tier };
      case 'health':
        return { health: 25 * tier };
      case 'defense':
        return { defense: 2 * tier };
    }
  }

  switch (line) {
    case 'crit':
      return { critRate: 4 * tier, critDamage: 8 * tier };
    case 'mana':
      return { mana: 30 * tier, int: 2 * tier };
    case 'health':
      return { health: 50 * tier, str: 2 * tier };
    case 'defense':
      return { defense: 4 * tier, health: 20 * tier };
  }
}

export type GearSeed = {
  name: string;
  category: string;
  image: string;
  requiredLevel: number;
  tier: number;
  /** `dungeon` pieces are kept out of the map drop tables entirely. */
  grade: Grade;
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
          grade: 'map',
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
        grade: 'map',
        stats: weaponStats(line, tier),
      });
    }

    for (const line of Object.keys(ACCESSORIES) as AccessoryLine[]) {
      const asset = ACCESSORIES[line][tier - 1];
      gear.push({
        name: displayName(asset),
        category: 'accessory',
        image: assetUrl(ACCESSORY_FOLDER, asset),
        requiredLevel,
        tier,
        grade: 'map',
        stats: accessoryStats(line, tier, 'map'),
      });

      const prefix = DUNGEON_TIER_PREFIX[tier];
      if (!prefix) continue;
      gear.push({
        name: displayName(`${prefix} ${DUNGEON_LINE_NOUN[line]}`),
        category: 'accessory',
        image: assetUrl(ACCESSORY_FOLDER, DUNGEON_ACCESSORY_ASSET[line]),
        requiredLevel,
        tier,
        grade: 'dungeon',
        stats: accessoryStats(line, tier, 'dungeon'),
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
      defense: piece.stats.defense ?? null,
      critRate: piece.stats.critRate ?? null,
      critDamage: piece.stats.critDamage ?? null,
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

    // The dungeon set is deliberately absent from every map table: it is the
    // reason to spend the day's one entry, and a monster that also dropped it
    // would take that reason away.
    const tierGear = gear.filter((piece) => piece.tier === tier && piece.grade === 'map');
    const monsters = [...map.monster].sort((a, b) => a.level - b.level);
    const boss = monsters.find((monster) => monster.boss) ?? monsters[monsters.length - 1];
    const normals = monsters.filter((monster) => monster.id !== boss.id);
    // The hardest ordinary monster shares the weapon table with the boss.
    const weaponHolders = [boss, normals[normals.length - 1]].filter(Boolean);

    for (const piece of tierGear) {
      const item = await prisma.item.findFirst({ where: { name: piece.name } });
      if (!item) throw new Error(`no item named "${piece.name}" — seed equipment first`);

      // Boots are the most common find, weapons the rarest.
      const chance = { weapon: 5, accessory: 4, armor: 8, legs: 9, boots: 10 }[piece.category] ?? 8;
      // Accessories hang off the same two monsters as the weapons: the crit slot
      // is the one worth chasing, so it should cost what a weapon costs.
      const holders =
        piece.category === 'weapon' || piece.category === 'accessory'
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

  console.log(`equipment drops: ${dropCount} placed at 4-10%`);
}
