/**
 * Guild content: the kill tasks a guild can take, the bosses it can stand up,
 * and the shelf its tokens are spent on.
 */
import { itemIdByName, mapIdByName, prisma } from './client';

const SPRITE_FOLDER = 'https://kidmortal.sirv.com/monsters';

/** A task is a kill count on one map, paid out in guild task points. */
const TASKS = [
  { name: 'Poring infestation', mapName: 'Poring Forest', killCount: 100, taskPoints: 150 },
  { name: 'Cursed Woods', mapName: 'Cemetery', killCount: 30, taskPoints: 400 },
];

/**
 * Easy-difficulty numbers; normal through nightmare multiply them. A guild boss
 * is its own row rather than a Monster: its health pool persists between
 * fights, so the guild wears it down over days.
 */
const BOSSES = [
  {
    name: 'King Poring',
    image: `${SPRITE_FOLDER}/KING_PORING.gif`,
    level: 10,
    health: 20000,
    attack: 25,
    taskPoints: 100,
    tokens: 100,
    silver: 150,
    exp: 200,
    requiredGuildLevel: 1,
  },
  {
    name: 'Kades',
    image: `${SPRITE_FOLDER}/KADES.gif`,
    level: 30,
    health: 80000,
    attack: 70,
    taskPoints: 300,
    tokens: 300,
    silver: 400,
    exp: 600,
    requiredGuildLevel: 5,
  },
];

/** Priced in guild tokens. Both potions are ordinary items elsewhere. */
const STORE = [
  { itemName: 'Healing Potion', price: 15, stack: 1 },
  { itemName: 'Mana Potion', price: 15, stack: 1 },
];

export async function seedGuildTasks() {
  for (const { mapName, ...task } of TASKS) {
    const data = { ...task, mapId: await mapIdByName(mapName) };
    await prisma.guildTask.upsert({ where: { name: task.name }, create: data, update: data });
  }
  console.log(`guild tasks: ${TASKS.length}`);
}

export async function seedGuildBosses() {
  for (const boss of BOSSES) {
    await prisma.guildBoss.upsert({ where: { name: boss.name }, create: boss, update: boss });
  }
  console.log(`guild bosses: ${BOSSES.length}`);
}

export async function seedGuildStore() {
  for (const { itemName, price, stack } of STORE) {
    const itemId = await itemIdByName(itemName);
    const data = { itemId, price, stack, enabled: true };
    await prisma.guildStoreProduct.upsert({ where: { itemId }, create: data, update: data });
  }
  console.log(`guild store products: ${STORE.length}`);
}
