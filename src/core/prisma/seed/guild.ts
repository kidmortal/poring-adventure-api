/**
 * Guild content: the kill tasks a guild can take, the bosses it can stand up,
 * and the shelf its tokens are spent on.
 */
import { itemIdByName, mapIdByName, prisma } from './client';

const SPRITE_FOLDER = 'https://kidmortal.sirv.com/monsters';

/**
 * A task is a kill count on one map, paid out in guild task points.
 *
 * Three to four per map, spread short to long: an evening's work for a small
 * guild, up to something worth taking a week over. Points climb faster than
 * kill counts do with the band, so a guild that can hold the Demon Sanctuary is
 * rewarded for going there rather than farming porings in bulk. Within a band
 * the rate per kill is flat, so the choice is how long a contract to commit to,
 * never which one pays better.
 *
 * `asset` is the sprite the offer shows. It is named per task rather than taken
 * from the map, whose own image is its boss — that is how a task to clear out
 * porings ended up advertising a King Poring. It is flavour only: progress
 * counts any kill on the map, so a task illustrated with a boss would still be
 * cleared on trash. That is why no task wears a boss sprite — it would promise
 * a hunt the counter does not ask for.
 */
const TASKS = [
  // Poring Forest — levels 1 to 10, ~1.6 points a kill.
  { name: 'Forest Cleanup', asset: 'LUNATIC', mapName: 'Poring Forest', killCount: 40, taskPoints: 70 },
  { name: 'Fabre Burrows', asset: 'FABRE', mapName: 'Poring Forest', killCount: 60, taskPoints: 95 },
  { name: 'Poring infestation', asset: 'PORING', mapName: 'Poring Forest', killCount: 100, taskPoints: 150 },
  { name: 'Ember Cull', asset: 'FIRE_PORING', mapName: 'Poring Forest', killCount: 150, taskPoints: 260 },

  // Willow Swamp — 11 to 20, ~3.4 a kill.
  { name: 'Willow Thinning', asset: 'PIERE', mapName: 'Willow Swamp', killCount: 25, taskPoints: 90 },
  { name: 'Serpent Nest', asset: 'SNAKE', mapName: 'Willow Swamp', killCount: 40, taskPoints: 140 },
  { name: 'Swamp Rot', asset: 'SPORE', mapName: 'Willow Swamp', killCount: 60, taskPoints: 200 },
  { name: 'Swamp Purge', asset: 'MARC', mapName: 'Willow Swamp', killCount: 100, taskPoints: 350 },

  // Cemetery — 21 to 30, ~12.5 a kill.
  { name: 'Cursed Woods', asset: 'FARMILIAR', mapName: 'Cemetery', killCount: 30, taskPoints: 400 },
  { name: 'Grave Watch', asset: 'MINI_DEMON', mapName: 'Cemetery', killCount: 60, taskPoints: 700 },
  { name: 'Blood Vigil', asset: 'BLOOD_BUTTERFLY', mapName: 'Cemetery', killCount: 100, taskPoints: 1250 },

  // Scorching Desert — 31 to 40, ~19 a kill.
  { name: 'Hive Burn', asset: 'HORNET', mapName: 'Scorching Desert', killCount: 25, taskPoints: 480 },
  { name: 'Desert Sweep', asset: 'SCORPION', mapName: 'Scorching Desert', killCount: 40, taskPoints: 800 },
  { name: 'Sandstorm Cull', asset: 'WOLF', mapName: 'Scorching Desert', killCount: 80, taskPoints: 1500 },
  { name: 'Dune March', asset: 'HEATER', mapName: 'Scorching Desert', killCount: 120, taskPoints: 2300 },

  // Demon Sanctuary — 42 to 50, ~39 a kill.
  { name: 'Sanctuary Breach', asset: 'HARPY', mapName: 'Demon Sanctuary', killCount: 30, taskPoints: 1200 },
  { name: 'Demon Purge', asset: 'EVIL_DRUID', mapName: 'Demon Sanctuary', killCount: 60, taskPoints: 2300 },
  { name: 'Unstable Ground', asset: 'EXPLOSION', mapName: 'Demon Sanctuary', killCount: 100, taskPoints: 3900 },
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
  { itemName: 'Health Potion', price: 15, stack: 1 },
  { itemName: 'Mana Potion', price: 15, stack: 1 },
];

export async function seedGuildTasks() {
  for (const { mapName, asset, ...task } of TASKS) {
    const data = { ...task, image: `${SPRITE_FOLDER}/${asset}.gif`, mapId: await mapIdByName(mapName) };
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
