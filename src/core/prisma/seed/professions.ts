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
  { name: 'Mining', icon: '⛏️', description: 'Break ore out of veins. Feeds the blacksmith.', kind: 'gathering', canEnhance: false },
  { name: 'Fishing', icon: '🎣', description: 'Pull fish out of any water you can reach. Feeds the cook.', kind: 'gathering', canEnhance: false },
  { name: 'Herbalism', icon: '🌿', description: 'Pick herbs in the wild. Feeds the alchemist.', kind: 'gathering', canEnhance: false },
  { name: 'Blacksmithing', icon: '🔨', description: 'Turn ore into weapons and armor.', kind: 'crafting', canEnhance: true },
  { name: 'Cooking', icon: '🍳', description: 'Turn raw food into meals that restore health.', kind: 'crafting', canEnhance: false },
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

const NODES: NodeSeed[] = [
  {
    name: 'Copper Vein',
    professionName: 'Mining',
    image: `${GATHERING_FOLDER}/copper_vein.webp`,
    requiredLevel: 1,
    staminaCost: 5,
    experience: 10,
    drops: [
      { itemName: 'Copper Ore', chance: 90, maxAmount: 3 },
      { itemName: 'Iron Ore', chance: 20 },
    ],
  },
  {
    name: 'Iron Vein',
    professionName: 'Mining',
    image: `${GATHERING_FOLDER}/iron_vein.webp`,
    requiredLevel: 3,
    staminaCost: 8,
    experience: 25,
    drops: [
      { itemName: 'Iron Ore', chance: 85, maxAmount: 3 },
      { itemName: 'Copper Ore', chance: 40, maxAmount: 2 },
    ],
  },
  {
    name: 'Calm River',
    professionName: 'Fishing',
    image: `${GATHERING_FOLDER}/calm_river.webp`,
    requiredLevel: 1,
    staminaCost: 5,
    experience: 10,
    drops: [
      { itemName: 'Raw Fish', chance: 80, maxAmount: 2 },
      { itemName: 'Fish Scale', chance: 40, maxAmount: 2 },
    ],
  },
  {
    name: 'Flower Field',
    professionName: 'Herbalism',
    image: `${GATHERING_FOLDER}/flower_field.webp`,
    requiredLevel: 1,
    staminaCost: 5,
    experience: 10,
    drops: [
      { itemName: 'Green Herb', chance: 85, maxAmount: 3 },
      { itemName: 'Blue Herb', chance: 25 },
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

const RECIPES: RecipeSeed[] = [
  // Blacksmithing produces the bottom of two weapon lines, so an ore stockpile
  // is an alternative to farming Poring Forest and Willow Swamp for the drop.
  {
    name: 'Bronze Sword',
    professionName: 'Blacksmithing',
    requiredLevel: 1,
    staminaCost: 5,
    experience: 15,
    amount: 1,
    ingredients: [{ itemName: 'Copper Ore', amount: 3 }],
  },
  {
    name: 'Steel Sword',
    professionName: 'Blacksmithing',
    requiredLevel: 3,
    staminaCost: 10,
    experience: 40,
    amount: 1,
    ingredients: [
      { itemName: 'Iron Ore', amount: 4 },
      { itemName: 'Copper Ore', amount: 1 },
    ],
  },
  {
    name: 'Grilled Fish',
    professionName: 'Cooking',
    requiredLevel: 1,
    staminaCost: 5,
    experience: 15,
    amount: 1,
    ingredients: [{ itemName: 'Raw Fish', amount: 2 }],
  },
  {
    name: 'Healing Potion',
    professionName: 'Alchemy',
    requiredLevel: 1,
    staminaCost: 5,
    experience: 15,
    amount: 1,
    ingredients: [{ itemName: 'Green Herb', amount: 2 }],
  },
  {
    name: 'Mana Potion',
    professionName: 'Alchemy',
    requiredLevel: 2,
    staminaCost: 5,
    experience: 20,
    amount: 1,
    ingredients: [{ itemName: 'Blue Herb', amount: 2 }],
  },
];

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
