/**
 * Dungeons: three bosses fought back to back on one entry a day.
 *
 * A dungeon is the counterweight to a map. A map is somewhere you go back to
 * all afternoon, so what it drops has to be rationed by chance; a dungeon is
 * one attempt, so it can pay properly. That is the whole trade — the numbers
 * below are far above the map curve because the day only allows one run at
 * them, and a party that wipes has spent it.
 *
 * Each dungeon sits on top of a map band and drops that band's gear, at rates
 * an afternoon of farming cannot match: the map is where you grind for a
 * weapon, the dungeon is where you have a real chance at one.
 */
import { itemIdByName, prisma } from './client';
import { gearCatalog } from './equipment';

const SPRITE_FOLDER = 'https://kidmortal.sirv.com/monsters';

function spriteUrl(asset: string) {
  return `${SPRITE_FOLDER}/${asset}.gif`;
}

/**
 * What a stage is worth, in health, damage and payout.
 *
 * The first two bosses are the toll: they are beatable, they pay little, and
 * what they really cost is the health the party still has when the third one
 * stands up. The third is the dungeon — twice the pool of anything on a map,
 * and worth more than the two before it put together.
 */
const STAGE_WEIGHT = {
  1: { health: 5, attack: 1.2, silver: 20, exp: 20, defense: 1.2 },
  2: { health: 6.5, attack: 1.4, silver: 30, exp: 28, defense: 1.2 },
  3: { health: 10, attack: 1.8, silver: 80, exp: 60, defense: 2 },
};

/**
 * The same level curve every monster is built on, weighted per stage. Derived
 * rather than typed out, so the whole set moves together when the curve does.
 */
function stageStats(level: number, stage: keyof typeof STAGE_WEIGHT) {
  const base = level * 10 + level * level * 0.6;
  const weight = STAGE_WEIGHT[stage];

  return {
    health: Math.round(base * weight.health),
    attack: Math.round(level * weight.attack),
    defense: Math.round(level * weight.defense),
    silver: level * weight.silver,
    exp: level * weight.exp,
    // Left at zero on purpose, exactly like every map boss: a monster with no
    // agi falls back to its level for the turn order and never dodges. The
    // difficulty here is meant to be the size of the numbers, not a coin flip
    // on whether the party's turn happened at all.
    agi: 0,
  };
}

type DropSeed = {
  itemName: string;
  chance: number;
  minAmount?: number;
  maxAmount?: number;
};

type BossSeed = {
  name: string;
  /** Sprite file name, which is not always the display name. */
  asset: string;
  level: number;
  /** On top of the tier gear every stage hands out by rule. */
  materials: DropSeed[];
};

type DungeonSeed = {
  name: string;
  description: string;
  recommendedLevel: number;
  /**
   * Which equipment tier the run pays out in. The band the dungeon sits on
   * top of — its gear is what the party is here for.
   */
  gearTier: number;
  /** Sprite for the card. The last boss, every time. */
  asset: string;
  /** Exactly three, in the order they are fought. */
  bosses: [BossSeed, BossSeed, BossSeed];
};

const DUNGEONS: DungeonSeed[] = [
  {
    name: 'Forgotten Crypt',
    description:
      'Something under the Cemetery has been keeping the dead awake. Three wardens stand between the gate and whatever it is.',
    recommendedLevel: 28,
    gearTier: 3,
    asset: 'KADES',
    bosses: [
      {
        name: 'Grave Familiar',
        asset: 'FARMILIAR',
        level: 25,
        materials: [
          { itemName: 'Bat Wing', chance: 80, minAmount: 2, maxAmount: 4 },
          { itemName: 'Bone Fragment', chance: 60, minAmount: 2, maxAmount: 3 },
        ],
      },
      {
        name: 'Crypt Demon',
        asset: 'MINI_DEMON',
        level: 27,
        materials: [{ itemName: 'Shadow Orb', chance: 70, minAmount: 2, maxAmount: 3 }],
      },
      {
        name: 'Kades, Warden of the Crypt',
        asset: 'KADES',
        level: 30,
        materials: [{ itemName: 'Shadow Orb', chance: 100, minAmount: 3, maxAmount: 5 }],
      },
    ],
  },
  {
    name: 'Scorched Tomb',
    description:
      'A tomb the desert has been trying to bury for a thousand years. Whatever was sealed in it is still awake, and still counting.',
    recommendedLevel: 40,
    gearTier: 4,
    asset: 'ANCIENT_MUMMY',
    bosses: [
      {
        name: 'Tomb Scorpion',
        asset: 'SCORPION',
        level: 38,
        materials: [
          { itemName: 'Poison Pouch', chance: 80, minAmount: 2, maxAmount: 4 },
          { itemName: 'Beast Claw', chance: 60, minAmount: 2, maxAmount: 3 },
        ],
      },
      {
        name: 'Ashen Heater',
        asset: 'HEATER',
        level: 40,
        materials: [{ itemName: 'Ivory Horn', chance: 70, minAmount: 1, maxAmount: 3 }],
      },
      {
        name: 'Ancient Mummy',
        asset: 'ANCIENT_MUMMY',
        level: 43,
        materials: [{ itemName: 'Ivory Horn', chance: 100, minAmount: 3, maxAmount: 5 }],
      },
    ],
  },
  {
    name: 'Demon Sanctum',
    description:
      'The floor beneath the Sanctuary, where the things the demons pray to are kept. Nothing here is worth fighting under level fifty.',
    recommendedLevel: 52,
    gearTier: 5,
    asset: 'BAPHOMET',
    bosses: [
      {
        name: 'Sanctum Harpy',
        asset: 'HARPY',
        level: 50,
        materials: [
          { itemName: 'Dark Wing', chance: 80, minAmount: 2, maxAmount: 4 },
          { itemName: 'Phoenix Feather', chance: 50, minAmount: 1, maxAmount: 2 },
        ],
      },
      {
        name: 'Elder Druid',
        asset: 'EVIL_DRUID',
        level: 53,
        materials: [{ itemName: 'Crystal Heart', chance: 70, minAmount: 1, maxAmount: 3 }],
      },
      {
        name: 'Baphomet, the Horned King',
        asset: 'BAPHOMET',
        level: 56,
        materials: [{ itemName: 'Crystal Heart', chance: 100, minAmount: 3, maxAmount: 5 }],
      },
    ],
  },
];

/**
 * The gear each stage puts on the table.
 *
 * Nothing in the middle: the second boss hands out the tier's three chest
 * pieces, one per armour line, so a party is never told the run was for a class
 * they did not bring. The third hands out all five weapons at once for the same
 * reason — a weapon is the piece a map makes you grind for at five percent, and
 * one attempt a day at twelve is the entire point of coming here.
 */
function gearDrops(tier: number, stage: number): DropSeed[] {
  const tierGear = gearCatalog().filter((piece) => piece.tier === tier);

  if (stage === 2) {
    return tierGear
      .filter((piece) => piece.category === 'armor')
      .map((piece) => ({ itemName: piece.name, chance: 18 }));
  }
  if (stage === 3) {
    return tierGear
      .filter((piece) => piece.category === 'weapon')
      .map((piece) => ({ itemName: piece.name, chance: 12 }));
  }
  return [];
}

async function seedDungeonDrops(monsterId: number, drops: DropSeed[]) {
  for (const drop of drops) {
    const itemId = await itemIdByName(drop.itemName);
    const data = {
      monsterId,
      itemId,
      chance: drop.chance,
      minAmount: drop.minAmount ?? 1,
      maxAmount: drop.maxAmount ?? drop.minAmount ?? 1,
    };
    await prisma.dungeonDrop.upsert({
      where: { monsterId_itemId: { monsterId, itemId } },
      create: data,
      update: data,
    });
  }
}

export async function seedDungeons() {
  let bossCount = 0;

  for (const [index, dungeon] of DUNGEONS.entries()) {
    const data = {
      name: dungeon.name,
      image: spriteUrl(dungeon.asset),
      description: dungeon.description,
      recommendedLevel: dungeon.recommendedLevel,
      sortOrder: index,
    };
    const { id: dungeonId } = await prisma.dungeon.upsert({
      where: { name: dungeon.name },
      create: data,
      update: data,
    });

    for (const [bossIndex, boss] of dungeon.bosses.entries()) {
      const stage = (bossIndex + 1) as keyof typeof STAGE_WEIGHT;
      const monsterData = {
        dungeonId,
        stage,
        name: boss.name,
        image: spriteUrl(boss.asset),
        level: boss.level,
        ...stageStats(boss.level, stage),
      };
      // Keyed on the stage rather than the name, so renaming a boss moves the
      // row it already has instead of leaving a second one behind it.
      const monster = await prisma.dungeonMonster.upsert({
        where: { dungeonId_stage: { dungeonId, stage } },
        create: monsterData,
        update: monsterData,
      });

      await seedDungeonDrops(monster.id, [...gearDrops(dungeon.gearTier, stage), ...boss.materials]);
      bossCount++;
    }
  }

  console.log(`dungeons: ${DUNGEONS.length}, dungeon bosses: ${bossCount}`);
}
