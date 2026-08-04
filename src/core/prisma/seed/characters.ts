/**
 * What a character is made of: the heads picked at creation, the classes, the
 * buffs a skill can apply, and the skills themselves. Buffs come before skills
 * because a skill points at the buff it grants.
 */
import { Prisma } from '@prisma/client';

import { prisma, upsertByName } from './client';
import { ConsumableAsset, consumableImage } from './assets';

const HEADS_FOLDER = 'https://kidmortal.sirv.com/heads';
const SKILLS_FOLDER = 'https://kidmortal.sirv.com/skills';
const BUFFS_FOLDER = 'https://kidmortal.sirv.com/buffs';

/** One row per gender, keyed by the pair — the same face exists for both. */
const HEADS = [
  { name: '1', gender: 'male' },
  { name: 'cat', gender: 'male' },
  { name: '1', gender: 'female' },
  { name: 'cat', gender: 'female' },
];

/**
 * The per-level stat block a class hands out. A level is worth exactly one copy
 * of it, so these numbers are the whole of character progression.
 */
const CLASSES = [
  {
    name: 'Rune Knight',
    icon: '⚔️',
    description: 'Sword and rune magic in one hand. Solid attack with the armour to stay in melee.',
    costume: 'rune_knight',
    attack: 3,
    health: 5,
    mana: 2,
    str: 2,
    agi: 2,
    int: 1,
    defense: 2,
  },
  {
    /**
     * Deliberately out-lasted rather than out-damaged by the Mage: the deepest
     * mana pool in the game against the shallowest scaling. Same intelligence
     * budget, spent on staying up instead of on burst.
     */
    name: 'Priest',
    icon: '✨',
    description: 'Support caster. Heals and blessings backed by the deepest mana pool in the game.',
    costume: 'priest',
    attack: 1,
    health: 3,
    mana: 6,
    str: 1,
    agi: 1,
    int: 3,
    defense: 1,
  },
  {
    name: 'Mage',
    icon: '🔮',
    description: 'Glass cannon caster. Highest intelligence, a shallow pool, and no armour at all.',
    costume: 'mage',
    attack: 1,
    health: 2,
    mana: 4,
    str: 1,
    agi: 1,
    int: 4,
    defense: 0,
  },
  {
    name: 'Knight',
    icon: '🛡️',
    description: 'Frontline tank. Trades damage for the armour and strength to hold a boss in place.',
    costume: 'knight',
    attack: 2,
    health: 7,
    mana: 1,
    str: 3,
    agi: 1,
    int: 1,
    defense: 3,
  },
  {
    name: 'Assassin',
    icon: '🗡️',
    description: 'Fast striker. Acts first, dodges most, and dies to anything that connects.',
    costume: 'assassin',
    attack: 5,
    health: 2,
    mana: 2,
    str: 1,
    agi: 4,
    int: 1,
    defense: 0,
  },
];

type BuffSeed = {
  name: string;
  effect: string;
  duration: number;
  image: string;
  pose: string;
  persist: boolean;
  maxStack: number;
  /** Percentages the "well_fed" effect reads. A meal is data, not code. */
  attackBonus?: number;
  healthBonus?: number;
};

/**
 * One meal buff. Spread rather than returned bare so the list above reads as a
 * flat table of tiers, which is how it is actually tuned.
 */
function mealBuff(args: {
  name: string;
  asset: ConsumableAsset;
  attackBonus?: number;
  healthBonus?: number;
  duration: number;
}): BuffSeed[] {
  return [
    {
      name: args.name,
      effect: 'well_fed',
      duration: args.duration,
      image: consumableImage(args.asset),
      pose: 'default',
      persist: true,
      maxStack: 2,
      attackBonus: args.attackBonus ?? 0,
      healthBonus: args.healthBonus ?? 0,
    },
  ];
}

const BUFFS: BuffSeed[] = [
  {
    name: 'Power up',
    effect: 'power_up',
    duration: 5,
    image: `${BUFFS_FOLDER}/powerup.webp`,
    pose: 'enhanced',
    persist: false,
    maxStack: 1,
  },
  {
    name: 'Invincible',
    effect: 'invincible',
    duration: 1,
    image: `${BUFFS_FOLDER}/invincible.webp`,
    pose: 'enhanced',
    persist: false,
    maxStack: 1,
  },
  /** Handed out by the admin tools, so it outlives the fight it was cast in. */
  {
    name: 'Admin Invincible',
    effect: 'invincible',
    duration: 99,
    image: `${BUFFS_FOLDER}/invincible.webp`,
    pose: 'enhanced',
    persist: true,
    maxStack: 1,
  },

  /**
   * The cook's line, one entry per meal tier.
   *
   * These persist, because a meal is eaten before a fight and would be
   * pointless if it evaporated on the way to one — they tick down per battle
   * instead, which is what makes the demand for food come back every day.
   *
   * `maxStack` is the ceiling on banked duration, not on how many buffs show at
   * once: eating four meals in a row cannot store twenty battles of +20% attack.
   *
   * Each buff wears its own dish as its icon. There is no separate buff art for
   * the food line, and pointing at a file that was never uploaded is exactly the
   * mistake `assets.ts` exists to prevent.
   */
  ...mealBuff({ name: 'Well Fed', asset: 'grilled_fish', attackBonus: 8, duration: 3 }),
  ...mealBuff({ name: 'Well Fed II', asset: 'grilled_skewer', attackBonus: 12, duration: 3 }),
  ...mealBuff({ name: 'Well Fed III', asset: 'roast_meat', attackBonus: 16, duration: 4 }),
  ...mealBuff({ name: 'Well Fed IV', asset: 'glazed_ham', attackBonus: 20, duration: 4 }),

  ...mealBuff({ name: 'Hearty', asset: 'soup_bowl', healthBonus: 8, duration: 3 }),
  ...mealBuff({ name: 'Hearty II', asset: 'stew_bowl', healthBonus: 12, duration: 3 }),
  ...mealBuff({ name: 'Hearty III', asset: 'curry_bowl', healthBonus: 16, duration: 4 }),
  ...mealBuff({ name: 'Hearty IV', asset: 'monster_stew', healthBonus: 20, duration: 4 }),

  ...mealBuff({ name: 'Balanced', asset: 'sushi_roll', attackBonus: 8, healthBonus: 8, duration: 4 }),
  ...mealBuff({ name: 'Balanced II', asset: 'pasta_dish', attackBonus: 12, healthBonus: 12, duration: 4 }),
  ...mealBuff({ name: 'Balanced III', asset: 'seafood_pasta', attackBonus: 15, healthBonus: 15, duration: 5 }),

  ...mealBuff({ name: 'Feasted', asset: 'fruit_platter', attackBonus: 10, duration: 3 }),
  ...mealBuff({ name: 'Feasted II', asset: 'grilled_platter', attackBonus: 14, duration: 3 }),
  ...mealBuff({ name: 'Feasted III', asset: 'sushi_platter', attackBonus: 12, healthBonus: 12, duration: 4 }),

  /** The alchemist's insurance: catches one killing blow, then is spent. */
  {
    name: 'Second Wind',
    effect: 'second_wind',
    duration: 3,
    image: consumableImage('golden_potion'),
    pose: 'default',
    persist: true,
    maxStack: 1,
  },
];

type SkillSeed = {
  name: string;
  /** Which class may learn it. */
  className: string;
  image: string;
  description: string;
  /** The stat the damage or healing scales off, times `multiplier`. */
  attribute: string;
  multiplier: number;
  /** Threat per point of damage. Left unset it is 1 — threat equal to damage. */
  threatModifier?: number;
  category: string;
  requiredLevel: number;
  manaCost: number;
  cooldown: number;
  effect?: string | null;
  /** Set when casting it applies a buff. */
  buffName?: string;
};

const SKILLS: SkillSeed[] = [
  {
    name: 'Fire Slash',
    className: 'Rune Knight',
    image: `${SKILLS_FOLDER}/fire_slash.webp`,
    description: 'Deals 200% str damage to the target.',
    attribute: 'str',
    multiplier: 2,
    category: 'target_enemy',
    requiredLevel: 1,
    manaCost: 2,
    cooldown: 1,
    effect: '',
  },
  {
    name: 'Water Flash',
    className: 'Rune Knight',
    image: `${SKILLS_FOLDER}/water_slash.webp`,
    description: 'Deals 300% int damage to the target.',
    attribute: 'int',
    multiplier: 3,
    category: 'target_enemy',
    requiredLevel: 3,
    manaCost: 5,
    cooldown: 1,
  },
  {
    name: 'Power up',
    className: 'Rune Knight',
    image: `${BUFFS_FOLDER}/powerup.webp`,
    description: 'Increases damage by 20%, defense by 20% and aggro by 300%',
    attribute: 'str',
    multiplier: 1,
    category: 'buff_self',
    requiredLevel: 1,
    manaCost: 5,
    cooldown: 4,
    effect: '',
    buffName: 'Power up',
  },
  {
    name: 'Light Healing',
    className: 'Priest',
    image: `${SKILLS_FOLDER}/healing.webp`,
    description: 'Heal the user with lowest health',
    attribute: 'int',
    multiplier: 3,
    category: 'target_ally',
    requiredLevel: 1,
    manaCost: 3,
    cooldown: 2,
    effect: 'healing',
  },
  {
    name: 'Light Missile',
    className: 'Priest',
    image: `${SKILLS_FOLDER}/light_missile.webp`,
    description: 'Deals 200% int damage to the target.',
    attribute: 'int',
    multiplier: 2,
    category: 'target_enemy',
    requiredLevel: 1,
    manaCost: 2,
    cooldown: 1,
  },
  {
    name: 'Mana Infusion',
    className: 'Priest',
    image: `${SKILLS_FOLDER}/infusion.webp`,
    description: 'Infuses mana to the user with lowest mana.',
    attribute: 'int',
    multiplier: 2,
    category: 'target_ally',
    requiredLevel: 1,
    manaCost: 0,
    cooldown: 3,
    effect: 'infusion',
  },
  {
    name: 'Fireball',
    className: 'Mage',
    image: `${SKILLS_FOLDER}/fireball.webp`,
    description: 'Deals 200% int damage to the target.',
    attribute: 'int',
    multiplier: 2,
    category: 'target_enemy',
    requiredLevel: 1,
    manaCost: 2,
    cooldown: 1,
  },
  {
    name: 'Icicle',
    className: 'Mage',
    image: `${SKILLS_FOLDER}/ice_shards.webp`,
    description: 'Deals 400% int damage to the target.',
    attribute: 'int',
    multiplier: 4,
    category: 'target_enemy',
    requiredLevel: 1,
    manaCost: 5,
    cooldown: 1,
  },
  {
    name: 'Backstab',
    className: 'Assassin',
    image: `${SKILLS_FOLDER}/backstab.webp`,
    description: 'Deals 400% agi damage to the target.',
    attribute: 'agi',
    multiplier: 4,
    category: 'target_enemy',
    requiredLevel: 1,
    manaCost: 2,
    cooldown: 1,
  },
];

export async function seedHeads() {
  for (const head of HEADS) {
    const data = { ...head, image: `${HEADS_FOLDER}/${head.gender}/${head.name}/front.png` };
    await prisma.head.upsert({
      where: { name_gender: { name: head.name, gender: head.gender } },
      create: data,
      update: data,
    });
  }
  console.log(`heads: ${HEADS.length}`);
}

export async function seedClasses() {
  for (const characterClass of CLASSES) {
    await prisma.class.upsert({
      where: { name: characterClass.name },
      create: characterClass,
      update: characterClass,
    });
  }
  console.log(`classes: ${CLASSES.length}`);
}

/**
 * Brings every existing character's defense in line with the class blocks above.
 *
 * Defense arrived after the characters did, so a level-40 Knight would otherwise
 * stand in the new mitigation formula with the zero their row was created with.
 * It is recomputed rather than incremented — `class.defense × level` is exactly
 * what levelling would have granted — so re-running the seed after a tuning pass
 * corrects everyone instead of stacking on top of the last one.
 *
 * This is safe only while no equipment grants defense. Once it does, gear has to
 * be added back on top and this becomes a one-off script rather than a seed step.
 */
export async function backfillDefense() {
  const classes = await prisma.class.findMany();
  let updated = 0;

  for (const characterClass of classes) {
    const result = await prisma.$executeRaw`
      UPDATE "Stats"
      SET "defense" = ${characterClass.defense} * "level"
      WHERE "userEmail" IN (SELECT "email" FROM "User" WHERE "classId" = ${characterClass.id})
    `;
    updated += result;
  }
  console.log(`defense backfilled: ${updated} characters`);
}

export async function seedBuffs() {
  for (const buff of BUFFS) {
    await prisma.buff.upsert({ where: { name: buff.name }, create: buff, update: buff });
  }
  console.log(`buffs: ${BUFFS.length}`);
}

export async function seedSkills() {
  for (const { className, buffName, ...skill } of SKILLS) {
    const characterClass = await prisma.class.findUnique({ where: { name: className } });
    if (!characterClass) throw new Error(`no class named "${className}" — seed classes first`);

    const buff = buffName ? await prisma.buff.findUnique({ where: { name: buffName } }) : null;
    if (buffName && !buff) throw new Error(`no buff named "${buffName}" — seed buffs first`);

    await upsertByName<Prisma.SkillUncheckedCreateInput>(prisma.skill, {
      ...skill,
      threatModifier: skill.threatModifier ?? 1,
      effect: skill.effect ?? null,
      classId: characterClass.id,
      buffId: buff?.id ?? null,
    });
  }
  console.log(`skills: ${SKILLS.length}`);
}
