/**
 * The map list, every monster standing on it, and what those monsters drop.
 *
 * Each map is one ten-level band and each band ends in a boss. Stats are
 * derived from the monster's level rather than typed out, so the whole curve
 * moves together — the two formulas below reproduce the hand-written King
 * Poring and Kades within a few points of what they used to be.
 */
import { Prisma } from '@prisma/client';

import { itemIdByName, prisma, upsertByName } from './client';

const SPRITE_FOLDER = 'https://kidmortal.sirv.com/monsters';

/** `ELDER_WILOW` → the gif the client points an `<img>` at. */
function spriteUrl(asset: string) {
  return `${SPRITE_FOLDER}/${asset}.gif`;
}

/**
 * A level costs the player `100 × level` experience, so paying out `6 × level`
 * a kill keeps a level worth roughly seventeen fights at any point in the game.
 */
function normalStats(level: number) {
  return {
    attack: Math.max(1, Math.round(level * 0.7)),
    health: Math.round(level * 10 + level * level * 0.6),
    silver: level * 5,
    exp: level * 6,
  };
}

/** A boss hits for its level, and is worth roughly three normal kills. */
function bossStats(level: number) {
  return {
    attack: level,
    health: normalStats(level).health * 5,
    silver: level * 20,
    exp: level * 20,
  };
}

type DropSeed = {
  itemName: string;
  chance: number;
  minAmount?: number;
  maxAmount?: number;
};

type MonsterSeed = {
  name: string;
  /** Sprite file name, which is not always the display name — FARMILIAR is. */
  asset: string;
  level: number;
  boss?: boolean;
  /** Consumables only. Equipment drops are placed by `seedEquipmentDrops`. */
  drops?: DropSeed[];
};

type MapSeed = {
  name: string;
  /** Sprite the map card is illustrated with — its boss, every time. */
  asset: string;
  monsters: MonsterSeed[];
};

const MAPS: MapSeed[] = [
  {
    name: 'Poring Forest',
    asset: 'KING_PORING',
    monsters: [
      {
        name: 'Poring',
        asset: 'PORING',
        level: 1,
        drops: [{ itemName: 'Slice of Cake', chance: 80, maxAmount: 2 }],
      },
      { name: 'Fabre', asset: 'FABRE', level: 2 },
      { name: 'Poporing', asset: 'POPORING', level: 4 },
      { name: 'Lunatic', asset: 'LUNATIC', level: 6, drops: [{ itemName: 'Bread', chance: 80, maxAmount: 3 }] },
      { name: 'Fire Poring', asset: 'FIRE_PORING', level: 8 },
      {
        name: 'King Poring',
        asset: 'KING_PORING',
        level: 10,
        boss: true,
        drops: [
          { itemName: 'Large Health Potion', chance: 40, maxAmount: 3 },
          { itemName: 'Large Mana Potion', chance: 40, maxAmount: 3 },
        ],
      },
    ],
  },
  {
    name: 'Willow Swamp',
    asset: 'ELDER_WILOW',
    monsters: [
      { name: 'Spore', asset: 'SPORE', level: 11 },
      { name: 'Vitata', asset: 'VITATA', level: 13 },
      { name: 'Marc', asset: 'MARC', level: 15 },
      { name: 'Snake', asset: 'SNAKE', level: 17 },
      { name: 'Piere', asset: 'PIERE', level: 18 },
      { name: 'Elder Willow', asset: 'ELDER_WILOW', level: 20, boss: true },
    ],
  },
  {
    name: 'Cemetery',
    asset: 'KADES',
    monsters: [
      { name: 'Familiar', asset: 'FARMILIAR', level: 21 },
      { name: 'Mini Demon', asset: 'MINI_DEMON', level: 24 },
      { name: 'Blood Butterfly', asset: 'BLOOD_BUTTERFLY', level: 27 },
      { name: 'Kades', asset: 'KADES', level: 30, boss: true },
    ],
  },
  {
    name: 'Scorching Desert',
    asset: 'ANCIENT_MUMMY',
    monsters: [
      { name: 'Scorpion', asset: 'SCORPION', level: 31 },
      { name: 'Hornet', asset: 'HORNET', level: 33 },
      { name: 'Wolf', asset: 'WOLF', level: 35 },
      { name: 'Heater', asset: 'HEATER', level: 37 },
      { name: 'Ancient Mummy', asset: 'ANCIENT_MUMMY', level: 40, boss: true },
    ],
  },
  {
    name: 'Demon Sanctuary',
    asset: 'BAPHOMET',
    monsters: [
      { name: 'Explosion', asset: 'EXPLOSION', level: 42 },
      { name: 'Harpy', asset: 'HARPY', level: 45 },
      { name: 'Evil Druid', asset: 'EVIL_DRUID', level: 47 },
      { name: 'Baphomet', asset: 'BAPHOMET', level: 50, boss: true },
    ],
  },
];

async function seedDrops(monsterId: number, drops: DropSeed[]) {
  for (const drop of drops) {
    const itemId = await itemIdByName(drop.itemName);
    const data = {
      monsterId,
      itemId,
      chance: drop.chance,
      minAmount: drop.minAmount ?? 1,
      maxAmount: drop.maxAmount ?? drop.minAmount ?? 1,
    };
    await prisma.drop.upsert({
      where: { monsterId_itemId: { monsterId, itemId } },
      create: data,
      update: data,
    });
  }
}

export async function seedMonsters() {
  let monsterCount = 0;

  for (const map of MAPS) {
    const mapId = await upsertByName<Prisma.MapUncheckedCreateInput>(prisma.map, {
      name: map.name,
      image: spriteUrl(map.asset),
    });

    for (const monster of map.monsters) {
      const monsterId = await upsertByName<Prisma.MonsterUncheckedCreateInput>(prisma.monster, {
        name: monster.name,
        image: spriteUrl(monster.asset),
        level: monster.level,
        boss: !!monster.boss,
        mapId,
        ...(monster.boss ? bossStats(monster.level) : normalStats(monster.level)),
      });
      // Only the declared drops are touched — a loot table added by hand on a
      // live database is left where it is.
      await seedDrops(monsterId, monster.drops ?? []);
      monsterCount++;
    }
  }

  console.log(`maps: ${MAPS.length}, monsters: ${monsterCount}`);
}
