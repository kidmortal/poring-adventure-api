/**
 * What a character is made of: the heads picked at creation, the classes, the
 * buffs a skill can apply, and the skills themselves. Buffs come before skills
 * because a skill points at the buff it grants.
 */
import { Prisma } from '@prisma/client';

import { prisma, upsertByName } from './client';
import { ConsumableAsset, consumableImage, SkillFolder, skillImage } from './assets';

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

  /**
   * The Priest's party-wide blessing. Modest percentages on purpose: it lands on
   * everybody at once, so what would be a fair number on one player is four
   * times that across a full party.
   */
  {
    name: 'Blessed',
    effect: 'blessed',
    duration: 4,
    image: skillImage('cleric', 'divine spirit'),
    pose: 'enhanced',
    persist: false,
    maxStack: 1,
    attackBonus: 10,
    healthBonus: 10,
  },

  /**
   * The two barriers, which are the same mechanic bought by different classes.
   *
   * A barrier is a flat pool spent before real health, so it is worth most
   * against a pack throwing out many small hits and least against a single
   * enormous one — the opposite of how defense behaves, which is what makes it
   * worth having on top of armour rather than instead of it.
   *
   * Their size is not written here: it comes off the caster's stats when the
   * skill goes up, so a level 50 Priest's shield is a level 50 shield.
   */
  {
    name: 'Aegis',
    effect: 'barrier',
    duration: 4,
    image: skillImage('cleric', 'blessing of protection'),
    pose: 'enhanced',
    persist: false,
    maxStack: 1,
  },
  {
    name: 'Mana Shield',
    effect: 'barrier',
    duration: 4,
    image: skillImage('mage', 'mana shield'),
    pose: 'enhanced',
    persist: false,
    maxStack: 1,
  },
];

/**
 * What a skill can leave on the monster it lands on. These are the enemy-side
 * mirror of the buffs above, and they are what the client draws beside the
 * health bar — so each one wears the art of the skill it is best known by.
 *
 * `potency` is a percentage, and what it is a percentage of belongs to the
 * effect: armour shredded, damage lost, or a share of the monster's starting
 * health burned each of its turns.
 */
const DEBUFFS = [
  {
    name: 'Sundered',
    effect: 'defense_down',
    duration: 3,
    image: skillImage('warrior', 'sunder armor'),
    potency: 25,
    maxStack: 2,
  },
  {
    name: 'Weakened',
    effect: 'attack_down',
    duration: 3,
    image: skillImage('rogue', 'crippling poison'),
    potency: 20,
    maxStack: 1,
  },
  {
    name: 'Poisoned',
    effect: 'poison',
    duration: 3,
    image: skillImage('rogue', 'deadly poison'),
    potency: 5,
    maxStack: 3,
  },
  {
    name: 'Burning',
    effect: 'poison',
    duration: 3,
    image: skillImage('mage', 'ignite'),
    potency: 6,
    maxStack: 2,
  },
  /**
   * The one debuff that takes a turn away outright, so it is deliberately short
   * and sits on long-cooldown skills only — a party that can chain it would
   * otherwise never be hit back.
   */
  {
    name: 'Frozen',
    effect: 'stun',
    duration: 1,
    image: skillImage('mage', 'frost nova'),
    potency: 0,
    maxStack: 1,
  },
  /** The same turn taken away, bought by the two classes that talk it out of fighting. */
  {
    name: 'Polymorphed',
    effect: 'stun',
    duration: 1,
    image: skillImage('mage', 'polymorph'),
    potency: 0,
    maxStack: 1,
  },
  {
    name: 'Feared',
    effect: 'stun',
    duration: 1,
    image: skillImage('cleric', 'psychic scream'),
    potency: 0,
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
  /** Set when landing it leaves a debuff on the enemy. */
  debuffName?: string;
  /** Hits every enemy, or heals the whole party, for 70% of its written power. */
  areaOfEffect?: boolean;
};

/**
 * A class's ladder from level 1 to 50.
 *
 * The four ladders below are written as tables because that is how they are
 * tuned — the interesting number in a row is `power`, and everything else is
 * either the art it wears or the level it arrives at. `power` is the multiplier
 * on the class's attribute, so a Mage's 8.0 Pyroblast and a Knight's 7.5
 * Bladestorm are not comparable: the Mage has four intelligence a level and the
 * Knight three strength, and the Knight is buying threat with the difference.
 *
 * Only the mechanics the battle engine actually has are used — damage, healing,
 * mana infusion, and a self-buff pointing at an existing buff row. A skill named
 * after a poison or a stun is a damage skill wearing that name until the engine
 * grows a status system; nothing here promises behaviour that does not exist.
 */
type Ladder = {
  className: string;
  folder: SkillFolder;
  /** The stat every skill on the ladder scales off. */
  attribute: string;
};

type Rung = {
  /** Art file name, which is also the skill's name once title-cased. */
  asset: string;
  level: number;
  /** Multiplier on the class attribute. */
  power: number;
  mana: number;
  cd: number;
  /** Threat per point of damage. A tank buys aggro here; a rogue sheds it. */
  threat?: number;
  description?: string;
};

/**
 * `arcane explosion` → `Arcane Explosion`, so the art and the name cannot drift.
 * `of` stays lowercase unless it leads — "Fan of Knives", not "Fan Of Knives".
 */
function skillName(asset: string) {
  return asset
    .split(' ')
    .map((word, index) => (index > 0 && word === 'of' ? word : word[0].toUpperCase() + word.slice(1)))
    .join(' ');
}

function ladderSkill(ladder: Ladder, rung: Rung, extra: Partial<SkillSeed> = {}): SkillSeed {
  const target = extra.areaOfEffect ? 'all enemies' : 'the target';
  return {
    name: skillName(rung.asset),
    className: ladder.className,
    image: skillImage(ladder.folder, rung.asset),
    description: rung.description ?? `Deals ${Math.round(rung.power * 100)}% ${ladder.attribute} damage to ${target}.`,
    attribute: ladder.attribute,
    multiplier: rung.power,
    category: 'target_enemy',
    requiredLevel: rung.level,
    manaCost: rung.mana,
    cooldown: rung.cd,
    threatModifier: rung.threat,
    effect: '',
    ...extra,
  };
}

const MAGE: Ladder = { className: 'Mage', folder: 'mage', attribute: 'int' };
const PRIEST: Ladder = { className: 'Priest', folder: 'cleric', attribute: 'int' };
const KNIGHT: Ladder = { className: 'Knight', folder: 'warrior', attribute: 'str' };
const ASSASSIN: Ladder = { className: 'Assassin', folder: 'rogue', attribute: 'agi' };

/**
 * A blessing on the whole party. The Priest's other half: a heal answers damage
 * that has already landed, a blessing answers the damage that has not, and it is
 * the reason to bring one to a fight that is going well rather than badly.
 */
function partyBuff(ladder: Ladder, rung: Rung, buffName: string, description: string): SkillSeed {
  return ladderSkill(ladder, rung, {
    category: 'buff_party',
    buffName,
    description: rung.description ?? description,
  });
}

/**
 * A barrier the caster raises on themselves — the same pool a Priest hands the
 * party, bought by a class that has to survive its own turn.
 */
function selfBarrier(ladder: Ladder, rung: Rung, buffName: string): SkillSeed {
  return ladderSkill(ladder, rung, {
    category: 'buff_self',
    buffName,
    description:
      rung.description ??
      `Raises a barrier absorbing ${Math.round(rung.power * 100)}% of your ${ladder.attribute} in damage.`,
  });
}

/** Heals the lowest-health party member. */
function heal(ladder: Ladder, rung: Rung): SkillSeed {
  return ladderSkill(ladder, rung, {
    category: 'target_ally',
    effect: 'healing',
    description: rung.description ?? `Heals an ally for ${Math.round(rung.power * 100)}% of your intelligence.`,
  });
}

/**
 * The party heal. It reaches everyone still standing at a reduced rate, which is
 * what makes a Priest worth a slot against a boss that hits the whole party
 * rather than only whoever is holding it.
 */
function groupHeal(ladder: Ladder, rung: Rung): SkillSeed {
  return ladderSkill(ladder, rung, {
    category: 'target_ally',
    effect: 'healing',
    areaOfEffect: true,
    description:
      rung.description ?? `Heals the whole party for ${Math.round(rung.power * 100)}% of your intelligence each.`,
  });
}

/**
 * Refills the caster and nobody else.
 *
 * Putting health or mana on somebody else is the Priest's job and the whole
 * reason the party keeps a slot for one. A Mage sustains itself — that is what
 * the rungs below are for — but the moment it can top up an ally it is a worse
 * Priest rather than a Mage, and the party stops needing the real one.
 */
function selfInfuse(ladder: Ladder, rung: Rung): SkillSeed {
  return ladderSkill(ladder, rung, {
    category: 'self_restore',
    effect: 'infusion',
    description: rung.description ?? `Restores ${Math.round(rung.power * 100)}% of your intelligence as your own mana.`,
  });
}

/** The same, spread across everyone still standing. */
function groupInfuse(ladder: Ladder, rung: Rung): SkillSeed {
  return ladderSkill(ladder, rung, {
    category: 'target_ally',
    effect: 'infusion',
    areaOfEffect: true,
    description:
      rung.description ?? `Restores ${Math.round(rung.power * 100)}% of your intelligence as mana to the whole party.`,
  });
}

/** The one turn of immunity every class gets, wearing a different name each time. */
function guard(ladder: Ladder, rung: Rung): SkillSeed {
  return ladderSkill(ladder, rung, {
    category: 'buff_self',
    buffName: 'Invincible',
    description: rung.description ?? 'Ignores all damage for one turn.',
  });
}

/**
 * The glass cannon's ladder: the steepest damage curve in the game, paid for out
 * of the shallowest mana pool. Threat is shaved off the big nukes so a Mage who
 * opens with Pyroblast does not immediately become the tank.
 */
const MAGE_LADDER: SkillSeed[] = [
  ladderSkill(MAGE, { asset: 'fireball', level: 1, power: 2, mana: 2, cd: 1 }),
  ladderSkill(MAGE, { asset: 'frostbolt', level: 3, power: 2.5, mana: 3, cd: 1 }),
  ladderSkill(MAGE, { asset: 'arcane missiles', level: 5, power: 3, mana: 4, cd: 2 }),
  ladderSkill(MAGE, { asset: 'fire blast', level: 8, power: 3.2, mana: 4, cd: 1 }),
  ladderSkill(
    MAGE,
    { asset: 'frost nova', level: 11, power: 3.5, mana: 6, cd: 2, threat: 0.5 },
    { areaOfEffect: true, debuffName: 'Frozen' },
  ),
  selfInfuse(MAGE, { asset: 'evocation', level: 14, power: 2, mana: 0, cd: 4 }),
  ladderSkill(MAGE, { asset: 'cone of cold', level: 17, power: 4, mana: 7, cd: 2 }, { areaOfEffect: true }),
  ladderSkill(MAGE, { asset: 'ignite', level: 20, power: 4.5, mana: 8, cd: 2 }, { debuffName: 'Burning' }),
  guard(MAGE, { asset: 'ice block', level: 23, power: 1, mana: 10, cd: 6 }),
  ladderSkill(
    MAGE,
    { asset: 'polymorph', level: 26, power: 3, mana: 9, cd: 4, threat: 0.3 },
    { debuffName: 'Polymorphed' },
  ),
  guard(MAGE, { asset: 'blink', level: 29, power: 1, mana: 6, cd: 4 }),
  ladderSkill(
    MAGE,
    { asset: 'flamestrike', level: 32, power: 5.5, mana: 11, cd: 3 },
    { areaOfEffect: true, debuffName: 'Burning' },
  ),
  ladderSkill(MAGE, { asset: 'arcane explosion', level: 36, power: 6, mana: 12, cd: 3 }, { areaOfEffect: true }),
  selfBarrier(MAGE, { asset: 'mana shield', level: 40, power: 4, mana: 8, cd: 5 }, 'Mana Shield'),
  selfInfuse(MAGE, { asset: 'arcane intellect', level: 45, power: 5, mana: 0, cd: 5 }),
  ladderSkill(MAGE, { asset: 'pyroblast', level: 50, power: 8, mana: 18, cd: 4, threat: 0.5 }),
];

/**
 * The healer's ladder. Every band carries a heal, because a Priest who has run
 * out of answers is a party slot spent on nothing, and the damage line is kept
 * deliberately behind the Mage's — a Priest out-lasts, they do not out-burn.
 */
const PRIEST_LADDER: SkillSeed[] = [
  heal(PRIEST, { asset: 'heal', level: 1, power: 3, mana: 3, cd: 2 }),
  ladderSkill(PRIEST, { asset: 'smite', level: 3, power: 2, mana: 2, cd: 1 }),
  heal(PRIEST, { asset: 'renew', level: 6, power: 2.5, mana: 2, cd: 1 }),
  ladderSkill(PRIEST, { asset: 'holy strike', level: 9, power: 2.5, mana: 4, cd: 1 }),
  heal(PRIEST, { asset: 'flash heal', level: 12, power: 4, mana: 7, cd: 1 }),
  partyBuff(
    PRIEST,
    { asset: 'divine spirit', level: 15, power: 1, mana: 6, cd: 4 },
    'Blessed',
    'Blesses the whole party: 10% more damage dealt and 10% less taken for four turns.',
  ),
  ladderSkill(PRIEST, { asset: 'mind blast', level: 18, power: 3.5, mana: 6, cd: 2 }),
  heal(PRIEST, { asset: 'regeneration', level: 21, power: 3.5, mana: 5, cd: 1 }),
  ladderSkill(
    PRIEST,
    { asset: 'holy nova', level: 24, power: 3.5, mana: 8, cd: 2, threat: 0.5 },
    { areaOfEffect: true },
  ),
  groupInfuse(PRIEST, { asset: 'dispel magic', level: 27, power: 3.5, mana: 0, cd: 4 }),
  heal(PRIEST, { asset: 'greater heal', level: 30, power: 5.5, mana: 10, cd: 2 }),
  ladderSkill(
    PRIEST,
    { asset: 'psychic scream', level: 33, power: 4, mana: 9, cd: 3, threat: 0.2 },
    { areaOfEffect: true, debuffName: 'Feared' },
  ),
  ladderSkill(PRIEST, { asset: 'holy fire', level: 36, power: 5, mana: 11, cd: 3 }),
  partyBuff(
    PRIEST,
    { asset: 'blessing of protection', level: 40, power: 4, mana: 14, cd: 5 },
    'Aegis',
    'Raises a barrier on every party member, each absorbing 400% of your intelligence in damage.',
  ),
  groupHeal(PRIEST, { asset: 'prayer of healing', level: 45, power: 7, mana: 14, cd: 3 }),
  heal(PRIEST, { asset: 'resurrection', level: 50, power: 10, mana: 20, cd: 6 }),
];

/**
 * The tank's ladder, and the only one that buys threat on purpose. Damage sits
 * below every other class at the same level; the threat modifiers are what the
 * strength is really spent on, so the Knight holds a boss the Assassin is
 * out-damaging three to one.
 */
const KNIGHT_LADDER: SkillSeed[] = [
  ladderSkill(KNIGHT, { asset: 'heroic strike', level: 1, power: 2, mana: 1, cd: 1, threat: 2 }),
  ladderSkill(KNIGHT, { asset: 'charge', level: 3, power: 2.2, mana: 2, cd: 2, threat: 2.5 }),
  ladderSkill(KNIGHT, { asset: 'cleave', level: 6, power: 2.5, mana: 2, cd: 1, threat: 2 }, { areaOfEffect: true }),
  // The Knight's version of the Rune Knight's Power up: the same buff row, since
  // "hit harder, take less, be looked at more" is exactly what a tank shouts for.
  ladderSkill(
    KNIGHT,
    {
      asset: 'battle shout',
      level: 9,
      power: 1,
      mana: 5,
      cd: 4,
      description: 'Increases damage by 20%, defense by 20% and aggro by 300%',
    },
    { category: 'buff_self', buffName: 'Power up' },
  ),
  ladderSkill(
    KNIGHT,
    { asset: 'sunder armor', level: 12, power: 2.8, mana: 3, cd: 2, threat: 3 },
    { debuffName: 'Sundered' },
  ),
  ladderSkill(KNIGHT, { asset: 'rend', level: 15, power: 3, mana: 3, cd: 1, threat: 2 }),
  guard(KNIGHT, { asset: 'shield block', level: 18, power: 1, mana: 6, cd: 6 }),
  ladderSkill(
    KNIGHT,
    { asset: 'thunder clap', level: 21, power: 3.2, mana: 4, cd: 2, threat: 3 },
    { areaOfEffect: true, debuffName: 'Weakened' },
  ),
  ladderSkill(KNIGHT, { asset: 'pummel', level: 24, power: 3.5, mana: 4, cd: 2, threat: 2.5 }),
  ladderSkill(KNIGHT, { asset: 'mortal strike', level: 27, power: 4, mana: 5, cd: 2, threat: 1.5 }),
  ladderSkill(KNIGHT, { asset: 'intimidating roar', level: 30, power: 3, mana: 5, cd: 3, threat: 4 }),
  ladderSkill(KNIGHT, { asset: 'shockwave', level: 34, power: 4.5, mana: 6, cd: 3, threat: 3 }, { areaOfEffect: true }),
  ladderSkill(KNIGHT, { asset: 'battle rage', level: 38, power: 5, mana: 6, cd: 2, threat: 2 }),
  ladderSkill(KNIGHT, { asset: 'whirlwind', level: 42, power: 5.5, mana: 7, cd: 3, threat: 2 }, { areaOfEffect: true }),
  ladderSkill(KNIGHT, { asset: 'execute', level: 46, power: 6.5, mana: 8, cd: 3, threat: 1 }),
  ladderSkill(
    KNIGHT,
    { asset: 'bladestorm', level: 50, power: 7.5, mana: 10, cd: 4, threat: 2.5 },
    { areaOfEffect: true },
  ),
];

/**
 * The striker's ladder. Damage close to the Mage's off a class with no armour
 * at all, and threat below one on every rung — an Assassin who pulls the boss
 * off the Knight dies to the next swing, so shedding aggro is the class's real
 * defensive stat.
 */
const ASSASSIN_LADDER: SkillSeed[] = [
  ladderSkill(ASSASSIN, { asset: 'backstab', level: 1, power: 2.5, mana: 2, cd: 1, threat: 0.5 }),
  ladderSkill(ASSASSIN, { asset: 'ambush', level: 3, power: 3, mana: 3, cd: 2, threat: 0.5 }),
  ladderSkill(ASSASSIN, { asset: 'sap', level: 6, power: 3, mana: 3, cd: 2, threat: 0.3 }),
  ladderSkill(ASSASSIN, { asset: 'blind', level: 9, power: 3.2, mana: 4, cd: 2, threat: 0.3 }),
  ladderSkill(
    ASSASSIN,
    { asset: 'crippling poison', level: 12, power: 3.5, mana: 4, cd: 2, threat: 0.5 },
    { debuffName: 'Weakened' },
  ),
  ladderSkill(ASSASSIN, { asset: 'sprint', level: 15, power: 3.5, mana: 3, cd: 2, threat: 0.2 }),
  ladderSkill(ASSASSIN, { asset: 'kidney shot', level: 18, power: 4, mana: 5, cd: 2, threat: 0.5 }),
  ladderSkill(
    ASSASSIN,
    { asset: 'fan of knives', level: 21, power: 4.2, mana: 6, cd: 2, threat: 0.8 },
    { areaOfEffect: true },
  ),
  ladderSkill(ASSASSIN, { asset: 'weakening toxin', level: 24, power: 4.5, mana: 6, cd: 3, threat: 0.4 }),
  ladderSkill(ASSASSIN, { asset: 'stealth', level: 27, power: 5, mana: 6, cd: 3, threat: 0.1 }),
  ladderSkill(ASSASSIN, { asset: 'shadowstep', level: 30, power: 5.2, mana: 7, cd: 2, threat: 0.3 }),
  ladderSkill(ASSASSIN, { asset: 'rupture', level: 34, power: 5.5, mana: 7, cd: 3, threat: 0.5 }),
  ladderSkill(
    ASSASSIN,
    { asset: 'deadly poison', level: 38, power: 6, mana: 8, cd: 3, threat: 0.4 },
    { debuffName: 'Poisoned' },
  ),
  ladderSkill(ASSASSIN, { asset: 'envenom', level: 42, power: 6.5, mana: 9, cd: 3, threat: 0.5 }),
  guard(ASSASSIN, { asset: 'vanish', level: 46, power: 1, mana: 10, cd: 6 }),
  ladderSkill(
    ASSASSIN,
    { asset: 'blade flurry', level: 50, power: 8, mana: 12, cd: 4, threat: 0.6 },
    { areaOfEffect: true },
  ),
];

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
  ...MAGE_LADDER,
  ...PRIEST_LADDER,
  ...KNIGHT_LADDER,
  ...ASSASSIN_LADDER,
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

export async function seedDebuffs() {
  for (const debuff of DEBUFFS) {
    await prisma.debuff.upsert({ where: { name: debuff.name }, create: debuff, update: debuff });
  }
  console.log(`debuffs: ${DEBUFFS.length}`);
}

/**
 * The support monopoly, checked rather than trusted.
 *
 * Only a Priest may put health or mana on somebody else — every other class
 * sustains itself or not at all. Written as a seed guard because the rule lives
 * in a `category` string that is easy to copy onto the wrong ladder, and a Mage
 * that can heal costs the Priest its reason to be in the party.
 */
function assertSupportIsPriestOnly() {
  const offenders = SKILLS.filter((skill) => skill.category === 'target_ally' && skill.className !== 'Priest').map(
    (skill) => `${skill.className}'s ${skill.name}`,
  );

  if (offenders.length > 0) {
    throw new Error(`only a Priest may heal or infuse an ally — found ${offenders.join(', ')}`);
  }
}

export async function seedSkills() {
  assertSupportIsPriestOnly();

  for (const { className, buffName, debuffName, ...skill } of SKILLS) {
    const characterClass = await prisma.class.findUnique({ where: { name: className } });
    if (!characterClass) throw new Error(`no class named "${className}" — seed classes first`);

    const buff = buffName ? await prisma.buff.findUnique({ where: { name: buffName } }) : null;
    if (buffName && !buff) throw new Error(`no buff named "${buffName}" — seed buffs first`);

    const debuff = debuffName ? await prisma.debuff.findUnique({ where: { name: debuffName } }) : null;
    if (debuffName && !debuff) throw new Error(`no debuff named "${debuffName}" — seed debuffs first`);

    await upsertByName<Prisma.SkillUncheckedCreateInput>(prisma.skill, {
      ...skill,
      threatModifier: skill.threatModifier ?? 1,
      areaOfEffect: skill.areaOfEffect ?? false,
      effect: skill.effect ?? null,
      classId: characterClass.id,
      buffId: buff?.id ?? null,
      debuffId: debuff?.id ?? null,
    });
  }
  console.log(`skills: ${SKILLS.length}`);
}
