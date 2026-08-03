/**
 * The trades: the professions themselves, the nodes the gathering ones harvest,
 * and the recipes the crafting ones consume that harvest with. Everything here
 * resolves items by name, so `seedItems` has to have run first.
 */
import { itemIdByName, prisma } from './client';

const GATHERING_FOLDER = 'https://kidmortal.sirv.com/gathering';

/**
 * A player practises one profession at a time. "gathering" turns stamina into
 * materials, "crafting" turns materials plus stamina into an item.
 */
const PROFESSIONS = [
  {
    name: 'Mining',
    icon: '⛏️',
    description: 'Break ore out of veins. Feeds the blacksmith.',
    kind: 'gathering',
    canEnhance: false,
  },
  {
    name: 'Fishing',
    icon: '🎣',
    description: 'Pull fish out of any water you can reach. Feeds the cook.',
    kind: 'gathering',
    canEnhance: false,
  },
  {
    name: 'Herbalism',
    icon: '🌿',
    description: 'Pick herbs in the wild. Feeds the alchemist.',
    kind: 'gathering',
    canEnhance: false,
  },
  {
    name: 'Blacksmithing',
    icon: '🔨',
    description: 'Turn ore into weapons and armor.',
    kind: 'crafting',
    canEnhance: true,
  },
  {
    name: 'Cooking',
    icon: '🍳',
    description: 'Turn raw food into meals that buff a party before a fight.',
    kind: 'crafting',
    canEnhance: false,
  },
  { name: 'Alchemy', icon: '⚗️', description: 'Brew herbs into potions.', kind: 'crafting', canEnhance: false },
];

type NodeSeed = {
  name: string;
  professionName: string;
  image: string;
  requiredLevel: number;
  staminaCost: number;
  experience: number;
  drops: { itemName: string; chance: number; minAmount?: number; maxAmount?: number }[];
};

/**
 * Nodes ride the same five bands the gear and the maps do — profession level 1,
 * 10, 20, 30 and 40 against the level 1, 11, 21, 31 and 41 areas. Gathering had
 * four nodes total and no curve at all; each band now has one per trade, so a
 * gatherer has somewhere to go after their first week.
 */
/**
 * Where the raw goods come from. Three trades, five bands each, matched to the
 * profession levels the recipes ask for — 1, 10, 20, 30, 40 — so a gatherer's
 * next node unlocks at roughly the same time as the recipe that wants what it
 * produces.
 *
 * Herbalism carries the widest tables because it feeds two crafts: herbs for
 * the alchemist and produce for the cook, who cannot make a meal out of a fish
 * and nothing else.
 */
const NODES: NodeSeed[] = [
  // ------------------------------------------------------------ Mining
  {
    name: 'Copper Vein',
    professionName: 'Mining',
    image: `${GATHERING_FOLDER}/copper_vein.webp`,
    requiredLevel: 1,
    staminaCost: 5,
    experience: 10,
    drops: [
      { itemName: 'Copper Ore', chance: 90, maxAmount: 3 },
      { itemName: 'Stone Chunk', chance: 60, maxAmount: 2 },
    ],
  },
  {
    name: 'Iron Vein',
    professionName: 'Mining',
    image: `${GATHERING_FOLDER}/iron_vein.webp`,
    requiredLevel: 10,
    staminaCost: 8,
    experience: 25,
    drops: [
      { itemName: 'Iron Ore', chance: 85, maxAmount: 3 },
      { itemName: 'Silver Ore', chance: 35, maxAmount: 2 },
      { itemName: 'Copper Ore', chance: 40, maxAmount: 2 },
    ],
  },
  {
    name: 'Jade Seam',
    professionName: 'Mining',
    image: `${GATHERING_FOLDER}/jade_seam.webp`,
    requiredLevel: 20,
    staminaCost: 10,
    experience: 45,
    drops: [
      { itemName: 'Jade Ore', chance: 80, maxAmount: 3 },
      { itemName: 'Crystal Cluster', chance: 35, maxAmount: 2 },
      { itemName: 'Iron Ore', chance: 40, maxAmount: 2 },
    ],
  },
  {
    name: 'Ember Quarry',
    professionName: 'Mining',
    image: `${GATHERING_FOLDER}/ember_quarry.webp`,
    requiredLevel: 30,
    staminaCost: 12,
    experience: 70,
    drops: [
      { itemName: 'Gold Dust', chance: 75, maxAmount: 3 },
      { itemName: 'Fire Crystal', chance: 40, maxAmount: 2 },
      { itemName: 'Jade Ore', chance: 35, maxAmount: 2 },
    ],
  },
  {
    name: 'Sunken Lode',
    professionName: 'Mining',
    image: `${GATHERING_FOLDER}/sunken_lode.webp`,
    requiredLevel: 40,
    staminaCost: 15,
    experience: 100,
    drops: [
      { itemName: 'Dark Ore', chance: 70, maxAmount: 3 },
      { itemName: 'Prism Gem', chance: 30, maxAmount: 2 },
      { itemName: 'Gold Dust', chance: 40, maxAmount: 2 },
    ],
  },

  // ------------------------------------------------------------ Fishing
  {
    name: 'Calm River',
    professionName: 'Fishing',
    image: `${GATHERING_FOLDER}/calm_river.webp`,
    requiredLevel: 1,
    staminaCost: 5,
    experience: 10,
    drops: [
      { itemName: 'Raw Fish', chance: 85, maxAmount: 3 },
      { itemName: 'Pink Shell', chance: 50, maxAmount: 2 },
    ],
  },
  {
    name: 'Reed Shallows',
    professionName: 'Fishing',
    image: `${GATHERING_FOLDER}/reed_shallows.webp`,
    requiredLevel: 10,
    staminaCost: 8,
    experience: 25,
    drops: [
      { itemName: 'Dried Fish', chance: 80, maxAmount: 3 },
      { itemName: 'Blue Shell', chance: 45, maxAmount: 2 },
      { itemName: 'Raw Fish', chance: 50, maxAmount: 2 },
    ],
  },
  {
    name: 'Kelp Bed',
    professionName: 'Fishing',
    image: `${GATHERING_FOLDER}/kelp_bed.webp`,
    requiredLevel: 20,
    staminaCost: 10,
    experience: 45,
    drops: [
      { itemName: 'Salmon Fillet', chance: 75, maxAmount: 3 },
      { itemName: 'Seaweed', chance: 60, maxAmount: 3 },
      { itemName: 'Raw Fish', chance: 45, maxAmount: 2 },
    ],
  },
  {
    name: 'Open Water',
    professionName: 'Fishing',
    image: `${GATHERING_FOLDER}/open_water.webp`,
    requiredLevel: 30,
    staminaCost: 12,
    experience: 70,
    drops: [
      { itemName: 'Tuna Fish', chance: 70, maxAmount: 3 },
      { itemName: 'Crab Legs', chance: 45, maxAmount: 2 },
      { itemName: 'Raw Shrimp', chance: 50, maxAmount: 3 },
    ],
  },
  {
    name: 'Coral Deep',
    professionName: 'Fishing',
    image: `${GATHERING_FOLDER}/coral_deep.webp`,
    requiredLevel: 40,
    staminaCost: 15,
    experience: 100,
    drops: [
      { itemName: 'White Coral', chance: 65, maxAmount: 3 },
      { itemName: 'Tuna Fish', chance: 55, maxAmount: 3 },
      { itemName: 'Crab Legs', chance: 50, maxAmount: 3 },
    ],
  },

  // ------------------------------------------------------------ Herbalism
  {
    name: 'Flower Field',
    professionName: 'Herbalism',
    image: `${GATHERING_FOLDER}/flower_field.webp`,
    requiredLevel: 1,
    staminaCost: 5,
    experience: 10,
    drops: [
      { itemName: 'Green Herb', chance: 85, maxAmount: 3 },
      { itemName: 'Herb Leaf', chance: 60, maxAmount: 2 },
      { itemName: 'Wheat Bundle', chance: 45, maxAmount: 2 },
      // The cook's sweetener. It has to come off a node somewhere, and a field
      // of flowers is where the bees are.
      { itemName: 'Honey Pot', chance: 30, maxAmount: 1 },
    ],
  },
  {
    name: 'Kitchen Garden',
    professionName: 'Herbalism',
    image: `${GATHERING_FOLDER}/kitchen_garden.webp`,
    requiredLevel: 10,
    staminaCost: 8,
    experience: 25,
    drops: [
      { itemName: 'Blue Herb', chance: 80, maxAmount: 3 },
      { itemName: 'Carrot', chance: 60, maxAmount: 3 },
      { itemName: 'Mushroom', chance: 50, maxAmount: 2 },
    ],
  },
  {
    name: 'Old Terrace',
    professionName: 'Herbalism',
    image: `${GATHERING_FOLDER}/old_terrace.webp`,
    requiredLevel: 20,
    staminaCost: 10,
    experience: 45,
    drops: [
      { itemName: 'Clover Herb', chance: 75, maxAmount: 3 },
      { itemName: 'Ginseng Root', chance: 45, maxAmount: 2 },
      { itemName: 'Rice Barrel', chance: 50, maxAmount: 2 },
      { itemName: 'Honey Pot', chance: 40, maxAmount: 2 },
    ],
  },
  {
    name: 'Sunlit Ridge',
    professionName: 'Herbalism',
    image: `${GATHERING_FOLDER}/sunlit_ridge.webp`,
    requiredLevel: 30,
    staminaCost: 12,
    experience: 70,
    drops: [
      { itemName: 'Azure Herb', chance: 70, maxAmount: 3 },
      { itemName: 'Moon Blossom', chance: 40, maxAmount: 2 },
      { itemName: 'Spice Pouch', chance: 50, maxAmount: 2 },
    ],
  },
  {
    name: 'Hidden Grove',
    professionName: 'Herbalism',
    image: `${GATHERING_FOLDER}/hidden_grove.webp`,
    requiredLevel: 40,
    staminaCost: 15,
    experience: 100,
    drops: [
      { itemName: 'Dragon Herb', chance: 65, maxAmount: 3 },
      { itemName: 'Fairy Essence', chance: 35, maxAmount: 2 },
      { itemName: 'Four Leaf Clover', chance: 25, maxAmount: 1 },
    ],
  },
];

type RecipeSeed = {
  /** Named after what it produces, which is also the item it resolves. */
  name: string;
  professionName: string;
  requiredLevel: number;
  staminaCost: number;
  experience: number;
  amount: number;
  ingredients: { itemName: string; amount: number }[];
};

/**
 * What the crafting trades make.
 *
 * Each line climbs with the gathering bands that feed it, and each trade owns a
 * verb nothing else can do: the smith makes gear, the alchemist makes the only
 * things usable in the middle of a fight, and the cook makes the only buffs you
 * can bring with you. Cooking deliberately reaches across two gatherers — fish
 * and produce — so a cook keeps two suppliers in business rather than one.
 */
const RECIPES: RecipeSeed[] = [
  // ------------------------------------------------------- Blacksmithing
  {
    name: 'Bronze Sword',
    professionName: 'Blacksmithing',
    requiredLevel: 1,
    staminaCost: 5,
    experience: 15,
    amount: 1,
    ingredients: [
      { itemName: 'Copper Ore', amount: 3 },
      { itemName: 'Stone Chunk', amount: 1 },
    ],
  },
  {
    name: 'Steel Sword',
    professionName: 'Blacksmithing',
    requiredLevel: 10,
    staminaCost: 10,
    experience: 40,
    amount: 1,
    ingredients: [
      { itemName: 'Iron Ore', amount: 4 },
      { itemName: 'Copper Ore', amount: 2 },
    ],
  },
  // One weapon per band, so the smith has somewhere to go once the ore does.
  // Mining reaches level 40; before this the forge stopped at 10 and three
  // tiers of ore fed nothing but the commission board.
  {
    name: 'Flame Longsword',
    professionName: 'Blacksmithing',
    requiredLevel: 20,
    staminaCost: 14,
    experience: 80,
    amount: 1,
    ingredients: [
      { itemName: 'Jade Ore', amount: 4 },
      { itemName: 'Iron Ore', amount: 3 },
      { itemName: 'Crystal Cluster', amount: 1 },
    ],
  },
  {
    name: 'Iron Warhammer',
    professionName: 'Blacksmithing',
    requiredLevel: 22,
    staminaCost: 14,
    experience: 85,
    amount: 1,
    ingredients: [
      { itemName: 'Jade Ore', amount: 3 },
      { itemName: 'Stone Chunk', amount: 4 },
      { itemName: 'Iron Ore', amount: 2 },
    ],
  },
  {
    name: 'Dragon Blade',
    professionName: 'Blacksmithing',
    requiredLevel: 30,
    staminaCost: 17,
    experience: 125,
    amount: 1,
    ingredients: [
      { itemName: 'Gold Dust', amount: 4 },
      { itemName: 'Fire Crystal', amount: 2 },
      { itemName: 'Ivory Horn', amount: 1 },
    ],
  },
  {
    name: 'Shadow Claws',
    professionName: 'Blacksmithing',
    requiredLevel: 34,
    staminaCost: 17,
    experience: 135,
    amount: 1,
    ingredients: [
      { itemName: 'Gold Dust', amount: 3 },
      { itemName: 'Beast Claw', amount: 3 },
      { itemName: 'Dark Ore', amount: 1 },
    ],
  },
  {
    name: 'Royal Greatsword',
    professionName: 'Blacksmithing',
    requiredLevel: 40,
    staminaCost: 20,
    experience: 180,
    amount: 1,
    ingredients: [
      { itemName: 'Dark Ore', amount: 5 },
      { itemName: 'Prism Gem', amount: 2 },
      { itemName: 'Crystal Heart', amount: 1 },
    ],
  },
  {
    name: 'Shadow Blade',
    professionName: 'Blacksmithing',
    requiredLevel: 42,
    staminaCost: 20,
    experience: 190,
    amount: 1,
    ingredients: [
      { itemName: 'Dark Ore', amount: 4 },
      { itemName: 'Dark Wing', amount: 2 },
      { itemName: 'Prism Gem', amount: 1 },
    ],
  },

  // ------------------------------------------------------------- Alchemy
  // Health in five tiers. Each one is a straight upgrade on the last, so the
  // reason to buy from a high level alchemist is the tier — and the reason to
  // buy from a *good* one is the quality roll on top of it.
  {
    name: 'Minor Health Potion',
    professionName: 'Alchemy',
    requiredLevel: 1,
    staminaCost: 4,
    experience: 12,
    amount: 2,
    ingredients: [{ itemName: 'Green Herb', amount: 2 }],
  },
  {
    name: 'Health Potion',
    professionName: 'Alchemy',
    requiredLevel: 8,
    staminaCost: 6,
    experience: 30,
    amount: 2,
    ingredients: [
      { itemName: 'Green Herb', amount: 3 },
      { itemName: 'Herb Leaf', amount: 2 },
    ],
  },
  {
    name: 'Greater Health Potion',
    professionName: 'Alchemy',
    requiredLevel: 16,
    staminaCost: 9,
    experience: 60,
    amount: 2,
    ingredients: [
      { itemName: 'Clover Herb', amount: 3 },
      { itemName: 'Ginseng Root', amount: 2 },
    ],
  },
  {
    name: 'Grand Health Flask',
    professionName: 'Alchemy',
    requiredLevel: 26,
    staminaCost: 12,
    experience: 95,
    amount: 2,
    ingredients: [
      { itemName: 'Azure Herb', amount: 3 },
      { itemName: 'Moon Blossom', amount: 2 },
      { itemName: 'Crystal Cluster', amount: 1 },
    ],
  },
  {
    name: 'Sovereign Elixir',
    professionName: 'Alchemy',
    requiredLevel: 38,
    staminaCost: 16,
    experience: 150,
    amount: 1,
    ingredients: [
      { itemName: 'Dragon Herb', amount: 3 },
      { itemName: 'Fairy Essence', amount: 2 },
      { itemName: 'Prism Gem', amount: 1 },
    ],
  },

  // Mana runs one tier shorter — running dry is a slower problem than dying.
  {
    name: 'Minor Mana Potion',
    professionName: 'Alchemy',
    requiredLevel: 2,
    staminaCost: 4,
    experience: 12,
    amount: 2,
    ingredients: [{ itemName: 'Blue Herb', amount: 2 }],
  },
  {
    name: 'Mana Potion',
    professionName: 'Alchemy',
    requiredLevel: 10,
    staminaCost: 6,
    experience: 32,
    amount: 2,
    ingredients: [
      { itemName: 'Blue Herb', amount: 3 },
      { itemName: 'Mushroom', amount: 2 },
    ],
  },
  {
    name: 'Greater Mana Potion',
    professionName: 'Alchemy',
    requiredLevel: 18,
    staminaCost: 9,
    experience: 62,
    amount: 2,
    ingredients: [
      { itemName: 'Clover Herb', amount: 2 },
      { itemName: 'Seaweed', amount: 3 },
    ],
  },
  {
    name: 'Grand Mana Flask',
    professionName: 'Alchemy',
    requiredLevel: 28,
    staminaCost: 12,
    experience: 98,
    amount: 2,
    ingredients: [
      { itemName: 'Azure Herb', amount: 3 },
      { itemName: 'Jade Ore', amount: 1 },
    ],
  },
  {
    name: 'Cyan Elixir',
    professionName: 'Alchemy',
    requiredLevel: 34,
    staminaCost: 14,
    experience: 130,
    amount: 1,
    ingredients: [
      { itemName: 'Moon Blossom', amount: 2 },
      { itemName: 'Azure Herb', amount: 2 },
      { itemName: 'Crystal Heart', amount: 1 },
    ],
  },

  // The utility line, which is what a Priest cannot replicate at any level.
  {
    name: 'Smoke Bomb',
    professionName: 'Alchemy',
    requiredLevel: 12,
    staminaCost: 7,
    experience: 40,
    amount: 2,
    ingredients: [
      { itemName: 'Poison Pouch', amount: 1 },
      { itemName: 'Herb Leaf', amount: 3 },
    ],
  },
  {
    name: 'Phoenix Draught',
    professionName: 'Alchemy',
    requiredLevel: 24,
    staminaCost: 15,
    experience: 100,
    amount: 1,
    ingredients: [
      { itemName: 'Phoenix Feather', amount: 1 },
      { itemName: 'Gold Dust', amount: 2 },
      { itemName: 'Clover Herb', amount: 2 },
    ],
  },

  // ------------------------------------------------------------- Cooking
  // Snacks: the cheap tier a level-one cook can actually shift, and the only
  // food that restores rather than buffs.
  {
    name: 'Bread Bun',
    professionName: 'Cooking',
    requiredLevel: 1,
    staminaCost: 4,
    experience: 12,
    amount: 3,
    ingredients: [{ itemName: 'Wheat Bundle', amount: 2 }],
  },
  {
    name: 'Rice Bowl',
    professionName: 'Cooking',
    requiredLevel: 6,
    staminaCost: 5,
    experience: 22,
    amount: 3,
    ingredients: [
      { itemName: 'Rice Barrel', amount: 1 },
      { itemName: 'Seaweed', amount: 1 },
    ],
  },
  {
    name: 'Round Cookie',
    professionName: 'Cooking',
    requiredLevel: 4,
    staminaCost: 5,
    experience: 18,
    amount: 4,
    ingredients: [
      { itemName: 'Wheat Bundle', amount: 2 },
      { itemName: 'Honey Pot', amount: 1 },
    ],
  },
  {
    name: 'White Tea',
    professionName: 'Cooking',
    requiredLevel: 8,
    staminaCost: 5,
    experience: 25,
    amount: 3,
    ingredients: [
      { itemName: 'Herb Leaf', amount: 2 },
      { itemName: 'Moon Blossom', amount: 1 },
    ],
  },
  {
    name: 'Strawberry Cake',
    professionName: 'Cooking',
    requiredLevel: 16,
    staminaCost: 8,
    experience: 55,
    amount: 2,
    ingredients: [
      { itemName: 'Wheat Bundle', amount: 3 },
      { itemName: 'Egg', amount: 2 },
      { itemName: 'Honey Pot', amount: 1 },
    ],
  },

  // The attack line.
  {
    name: 'Grilled Fish',
    professionName: 'Cooking',
    requiredLevel: 1,
    staminaCost: 5,
    experience: 15,
    amount: 1,
    ingredients: [
      { itemName: 'Raw Fish', amount: 2 },
      { itemName: 'Herb Leaf', amount: 1 },
    ],
  },
  {
    name: 'Grilled Skewer',
    professionName: 'Cooking',
    requiredLevel: 10,
    staminaCost: 8,
    experience: 40,
    amount: 1,
    ingredients: [
      { itemName: 'Raw Meat', amount: 2 },
      { itemName: 'Carrot', amount: 2 },
    ],
  },
  {
    name: 'Roast Meat',
    professionName: 'Cooking',
    requiredLevel: 20,
    staminaCost: 10,
    experience: 70,
    amount: 1,
    ingredients: [
      { itemName: 'Raw Meat', amount: 3 },
      { itemName: 'Spice Pouch', amount: 1 },
      { itemName: 'Ginseng Root', amount: 1 },
    ],
  },
  {
    name: 'Glazed Ham',
    professionName: 'Cooking',
    requiredLevel: 32,
    staminaCost: 13,
    experience: 115,
    amount: 1,
    ingredients: [
      { itemName: 'Raw Meat', amount: 4 },
      { itemName: 'Honey Pot', amount: 2 },
      { itemName: 'Spice Pouch', amount: 2 },
    ],
  },

  // The staying-power line.
  {
    name: 'Soup Bowl',
    professionName: 'Cooking',
    requiredLevel: 4,
    staminaCost: 5,
    experience: 20,
    amount: 1,
    ingredients: [
      { itemName: 'Carrot', amount: 2 },
      { itemName: 'Herb Leaf', amount: 1 },
    ],
  },
  {
    name: 'Stew Bowl',
    professionName: 'Cooking',
    requiredLevel: 14,
    staminaCost: 8,
    experience: 48,
    amount: 1,
    ingredients: [
      { itemName: 'Raw Meat', amount: 2 },
      { itemName: 'Mushroom', amount: 2 },
      { itemName: 'Carrot', amount: 1 },
    ],
  },
  {
    name: 'Curry Bowl',
    professionName: 'Cooking',
    requiredLevel: 24,
    staminaCost: 11,
    experience: 82,
    amount: 1,
    ingredients: [
      { itemName: 'Rice Barrel', amount: 1 },
      { itemName: 'Spice Pouch', amount: 2 },
      { itemName: 'Raw Meat', amount: 2 },
    ],
  },
  {
    name: 'Monster Stew',
    professionName: 'Cooking',
    requiredLevel: 34,
    staminaCost: 14,
    experience: 125,
    amount: 1,
    ingredients: [
      { itemName: 'Beast Claw', amount: 2 },
      { itemName: 'Serpent Tail', amount: 1 },
      { itemName: 'Mushroom', amount: 3 },
    ],
  },

  // Balanced meals: less of each than a specialist, and the safer buy when you
  // do not know what you are walking into.
  {
    name: 'Sushi Roll',
    professionName: 'Cooking',
    requiredLevel: 18,
    staminaCost: 9,
    experience: 62,
    amount: 1,
    ingredients: [
      { itemName: 'Salmon Fillet', amount: 2 },
      { itemName: 'Rice Barrel', amount: 1 },
      { itemName: 'Seaweed', amount: 1 },
    ],
  },
  {
    name: 'Pasta Dish',
    professionName: 'Cooking',
    requiredLevel: 26,
    staminaCost: 11,
    experience: 90,
    amount: 1,
    ingredients: [
      { itemName: 'Wheat Bundle', amount: 3 },
      { itemName: 'Cheese Wedge', amount: 1 },
      { itemName: 'Spice Pouch', amount: 1 },
    ],
  },
  {
    name: 'Seafood Pasta',
    professionName: 'Cooking',
    requiredLevel: 36,
    staminaCost: 14,
    experience: 130,
    amount: 1,
    ingredients: [
      { itemName: 'Crab Legs', amount: 2 },
      { itemName: 'Raw Shrimp', amount: 2 },
      { itemName: 'Wheat Bundle', amount: 2 },
    ],
  },

  // Platters feed the party — one craft, everybody buffed.
  {
    name: 'Fruit Platter',
    professionName: 'Cooking',
    requiredLevel: 22,
    staminaCost: 12,
    experience: 85,
    amount: 1,
    ingredients: [
      { itemName: 'Honey Pot', amount: 2 },
      { itemName: 'Moon Blossom', amount: 1 },
      { itemName: 'Clover Herb', amount: 2 },
    ],
  },
  {
    name: 'Grilled Platter',
    professionName: 'Cooking',
    requiredLevel: 30,
    staminaCost: 15,
    experience: 120,
    amount: 1,
    ingredients: [
      { itemName: 'Raw Meat', amount: 3 },
      { itemName: 'Tuna Fish', amount: 2 },
      { itemName: 'Spice Pouch', amount: 2 },
    ],
  },
  {
    name: 'Sushi Platter',
    professionName: 'Cooking',
    requiredLevel: 40,
    staminaCost: 18,
    experience: 165,
    amount: 1,
    ingredients: [
      { itemName: 'Tuna Fish', amount: 3 },
      { itemName: 'Salmon Fillet', amount: 3 },
      { itemName: 'White Coral', amount: 1 },
      { itemName: 'Rice Barrel', amount: 2 },
    ],
  },
];

/**
 * The nodes and recipes the catalog names. `retireLegacyConsumables` reads
 * these to find what an older roster left behind — the seed never deletes, so a
 * node pulled out of this file is still standing in the database, and once its
 * drops point at retired items it is a node that produces nothing.
 */
export function seededNodeNames() {
  return NODES.map((node) => node.name);
}

export function seededRecipeNames() {
  return RECIPES.map((recipe) => recipe.name);
}

async function professionIdByName(name: string) {
  const profession = await prisma.profession.findUnique({ where: { name } });
  if (!profession) throw new Error(`no profession named "${name}" — seed professions first`);
  return profession.id;
}

export async function seedProfessions() {
  for (const profession of PROFESSIONS) {
    await prisma.profession.upsert({
      where: { name: profession.name },
      create: profession,
      update: profession,
    });
  }
  console.log(`professions: ${PROFESSIONS.length}`);
}

export async function seedGatheringNodes() {
  for (const { professionName, drops, ...node } of NODES) {
    const data = { ...node, professionId: await professionIdByName(professionName) };
    const { id: nodeId } = await prisma.gatheringNode.upsert({
      where: { name: node.name },
      create: data,
      update: data,
    });

    for (const drop of drops) {
      const itemId = await itemIdByName(drop.itemName);
      const dropData = {
        nodeId,
        itemId,
        chance: drop.chance,
        minAmount: drop.minAmount ?? 1,
        maxAmount: drop.maxAmount ?? drop.minAmount ?? 1,
      };
      await prisma.gatheringDrop.upsert({
        where: { nodeId_itemId: { nodeId, itemId } },
        create: dropData,
        update: dropData,
      });
    }
  }
  console.log(`gathering nodes: ${NODES.length}`);
}

export async function seedRecipes() {
  for (const { professionName, ingredients, ...recipe } of RECIPES) {
    const data = {
      ...recipe,
      professionId: await professionIdByName(professionName),
      itemId: await itemIdByName(recipe.name),
    };
    const { id: recipeId } = await prisma.recipe.upsert({
      where: { name: recipe.name },
      create: data,
      update: data,
    });

    for (const ingredient of ingredients) {
      const itemId = await itemIdByName(ingredient.itemName);
      const ingredientData = { recipeId, itemId, amount: ingredient.amount };
      await prisma.recipeIngredient.upsert({
        where: { recipeId_itemId: { recipeId, itemId } },
        create: ingredientData,
        update: ingredientData,
      });
    }
  }
  console.log(`recipes: ${RECIPES.length}`);
}
