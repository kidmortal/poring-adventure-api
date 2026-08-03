/**
 * The commission board's contracts — the standing NPC orders that put a price
 * floor under everything the trades produce.
 *
 * Four are drawn per player per day, so what matters is the payout of a *board*
 * rather than of a single row. Averaged over a week of draws a full board is
 * worth roughly 350–800 silver at level 1, around 1,000–1,300 by level 10, and
 * 1,200–2,000 through the twenties where most players sit.
 *
 * Those are ceilings, not incomes. Stamina is the real limit: a day's budget
 * buys five or six crafts, so the larger contracts are two-day jobs and nobody
 * clears a whole board in a morning. Actual take-home lands near half the
 * figures above, which is the point — a fighter should still out-earn a crafter.
 *
 * Two rules the numbers follow. A contract must beat selling the same goods as
 * raw materials, or nobody fills it; and every trade needs four or more inside
 * its first few levels, or a new player opens the board to one lonely job.
 */
import { itemIdByName, prisma } from './client';

type CommissionSeed = {
  itemName: string;
  professionName: string;
  amount: number;
  silver: number;
  experience: number;
  requiredLevel: number;
};

const COMMISSIONS: CommissionSeed[] = [
  // ------------------------------------------------------- Blacksmithing
  // The fewest, largest contracts: its goods are the slowest to make and the
  // most valuable when they land.
  { itemName: 'Copper Ore', professionName: 'Blacksmithing', amount: 5, silver: 130, experience: 13, requiredLevel: 1 },
  {
    itemName: 'Bronze Sword',
    professionName: 'Blacksmithing',
    amount: 1,
    silver: 150,
    experience: 15,
    requiredLevel: 1,
  },
  {
    itemName: 'Bronze Sword',
    professionName: 'Blacksmithing',
    amount: 2,
    silver: 310,
    experience: 30,
    requiredLevel: 1,
  },
  {
    itemName: 'Stone Chunk',
    professionName: 'Blacksmithing',
    amount: 8,
    silver: 160,
    experience: 16,
    requiredLevel: 1,
  },
  {
    itemName: 'Bronze Sword',
    professionName: 'Blacksmithing',
    amount: 3,
    silver: 480,
    experience: 46,
    requiredLevel: 5,
  },
  { itemName: 'Iron Ore', professionName: 'Blacksmithing', amount: 10, silver: 420, experience: 42, requiredLevel: 10 },
  {
    itemName: 'Steel Sword',
    professionName: 'Blacksmithing',
    amount: 1,
    silver: 480,
    experience: 45,
    requiredLevel: 10,
  },
  {
    itemName: 'Steel Sword',
    professionName: 'Blacksmithing',
    amount: 3,
    silver: 1500,
    experience: 140,
    requiredLevel: 20,
  },
  { itemName: 'Jade Ore', professionName: 'Blacksmithing', amount: 10, silver: 640, experience: 62, requiredLevel: 20 },
  {
    itemName: 'Gold Dust',
    professionName: 'Blacksmithing',
    amount: 10,
    silver: 890,
    experience: 86,
    requiredLevel: 30,
  },
  {
    itemName: 'Dark Ore',
    professionName: 'Blacksmithing',
    amount: 8,
    silver: 1210,
    experience: 120,
    requiredLevel: 40,
  },
  {
    itemName: 'Flame Longsword',
    professionName: 'Blacksmithing',
    amount: 1,
    silver: 900,
    experience: 88,
    requiredLevel: 20,
  },
  {
    itemName: 'Iron Warhammer',
    professionName: 'Blacksmithing',
    amount: 1,
    silver: 940,
    experience: 92,
    requiredLevel: 22,
  },
  {
    itemName: 'Dragon Blade',
    professionName: 'Blacksmithing',
    amount: 1,
    silver: 1350,
    experience: 132,
    requiredLevel: 30,
  },
  {
    itemName: 'Royal Greatsword',
    professionName: 'Blacksmithing',
    amount: 1,
    silver: 1950,
    experience: 190,
    requiredLevel: 40,
  },

  // ------------------------------------------------------------- Alchemy
  // Bought in bulk and consumed under pressure, so this board leans on volume
  // rather than on any single expensive contract.
  {
    itemName: 'Minor Health Potion',
    professionName: 'Alchemy',
    amount: 4,
    silver: 120,
    experience: 12,
    requiredLevel: 1,
  },
  {
    itemName: 'Minor Health Potion',
    professionName: 'Alchemy',
    amount: 8,
    silver: 250,
    experience: 25,
    requiredLevel: 1,
  },
  { itemName: 'Green Herb', professionName: 'Alchemy', amount: 8, silver: 165, experience: 16, requiredLevel: 1 },
  {
    itemName: 'Minor Mana Potion',
    professionName: 'Alchemy',
    amount: 4,
    silver: 125,
    experience: 12,
    requiredLevel: 2,
  },
  {
    itemName: 'Minor Mana Potion',
    professionName: 'Alchemy',
    amount: 8,
    silver: 260,
    experience: 26,
    requiredLevel: 4,
  },
  { itemName: 'Health Potion', professionName: 'Alchemy', amount: 4, silver: 330, experience: 33, requiredLevel: 8 },
  { itemName: 'Health Potion', professionName: 'Alchemy', amount: 8, silver: 690, experience: 68, requiredLevel: 12 },
  { itemName: 'Mana Potion', professionName: 'Alchemy', amount: 4, silver: 345, experience: 34, requiredLevel: 10 },
  { itemName: 'Smoke Bomb', professionName: 'Alchemy', amount: 4, silver: 480, experience: 48, requiredLevel: 12 },
  {
    itemName: 'Greater Health Potion',
    professionName: 'Alchemy',
    amount: 4,
    silver: 700,
    experience: 70,
    requiredLevel: 16,
  },
  {
    itemName: 'Greater Mana Potion',
    professionName: 'Alchemy',
    amount: 4,
    silver: 720,
    experience: 71,
    requiredLevel: 18,
  },
  { itemName: 'Phoenix Draught', professionName: 'Alchemy', amount: 2, silver: 940, experience: 94, requiredLevel: 24 },
  {
    itemName: 'Grand Health Flask',
    professionName: 'Alchemy',
    amount: 3,
    silver: 1180,
    experience: 118,
    requiredLevel: 26,
  },
  {
    itemName: 'Grand Mana Flask',
    professionName: 'Alchemy',
    amount: 3,
    silver: 1210,
    experience: 120,
    requiredLevel: 28,
  },
  { itemName: 'Cyan Elixir', professionName: 'Alchemy', amount: 2, silver: 1400, experience: 140, requiredLevel: 34 },
  {
    itemName: 'Sovereign Elixir',
    professionName: 'Alchemy',
    amount: 2,
    silver: 2100,
    experience: 210,
    requiredLevel: 38,
  },

  // ------------------------------------------------------------- Cooking
  // Meals get eaten, so these are the contracts that recur most naturally —
  // and the ones that keep a fisherman and a herbalist both in business.
  { itemName: 'Bread Bun', professionName: 'Cooking', amount: 4, silver: 110, experience: 11, requiredLevel: 1 },
  { itemName: 'Grilled Fish', professionName: 'Cooking', amount: 2, silver: 105, experience: 10, requiredLevel: 1 },
  { itemName: 'Grilled Fish', professionName: 'Cooking', amount: 4, silver: 215, experience: 21, requiredLevel: 1 },
  { itemName: 'Wheat Bundle', professionName: 'Cooking', amount: 8, silver: 160, experience: 16, requiredLevel: 1 },
  { itemName: 'Round Cookie', professionName: 'Cooking', amount: 6, silver: 200, experience: 20, requiredLevel: 4 },
  { itemName: 'Soup Bowl', professionName: 'Cooking', amount: 3, silver: 230, experience: 23, requiredLevel: 4 },
  { itemName: 'Rice Bowl', professionName: 'Cooking', amount: 6, silver: 265, experience: 26, requiredLevel: 6 },
  { itemName: 'Grilled Skewer', professionName: 'Cooking', amount: 3, silver: 450, experience: 45, requiredLevel: 10 },
  { itemName: 'Stew Bowl', professionName: 'Cooking', amount: 3, silver: 530, experience: 53, requiredLevel: 14 },
  { itemName: 'Strawberry Cake', professionName: 'Cooking', amount: 3, silver: 610, experience: 61, requiredLevel: 16 },
  { itemName: 'Sushi Roll', professionName: 'Cooking', amount: 3, silver: 680, experience: 68, requiredLevel: 18 },
  { itemName: 'Roast Meat', professionName: 'Cooking', amount: 3, silver: 770, experience: 77, requiredLevel: 20 },
  { itemName: 'Fruit Platter', professionName: 'Cooking', amount: 2, silver: 900, experience: 90, requiredLevel: 22 },
  { itemName: 'Curry Bowl', professionName: 'Cooking', amount: 3, silver: 960, experience: 96, requiredLevel: 24 },
  { itemName: 'Pasta Dish', professionName: 'Cooking', amount: 3, silver: 1030, experience: 103, requiredLevel: 26 },
  {
    itemName: 'Grilled Platter',
    professionName: 'Cooking',
    amount: 2,
    silver: 1240,
    experience: 124,
    requiredLevel: 30,
  },
  { itemName: 'Glazed Ham', professionName: 'Cooking', amount: 3, silver: 1380, experience: 138, requiredLevel: 32 },
  { itemName: 'Monster Stew', professionName: 'Cooking', amount: 3, silver: 1490, experience: 149, requiredLevel: 34 },
  { itemName: 'Seafood Pasta', professionName: 'Cooking', amount: 3, silver: 1600, experience: 160, requiredLevel: 36 },
  { itemName: 'Sushi Platter', professionName: 'Cooking', amount: 2, silver: 1900, experience: 190, requiredLevel: 40 },

  // -------------------------------------------------------------- Mining
  // Gathering trades sell raw, on thinner margins than a crafter's. That is
  // deliberate: a gatherer's best customer should be a crafter, not the NPC.
  { itemName: 'Copper Ore', professionName: 'Mining', amount: 6, silver: 120, experience: 12, requiredLevel: 1 },
  { itemName: 'Copper Ore', professionName: 'Mining', amount: 12, silver: 240, experience: 25, requiredLevel: 1 },
  { itemName: 'Stone Chunk', professionName: 'Mining', amount: 10, silver: 190, experience: 19, requiredLevel: 1 },
  { itemName: 'Copper Ore', professionName: 'Mining', amount: 20, silver: 410, experience: 42, requiredLevel: 3 },
  { itemName: 'Iron Ore', professionName: 'Mining', amount: 6, silver: 205, experience: 20, requiredLevel: 10 },
  { itemName: 'Iron Ore', professionName: 'Mining', amount: 12, silver: 415, experience: 41, requiredLevel: 10 },
  { itemName: 'Silver Ore', professionName: 'Mining', amount: 10, silver: 520, experience: 52, requiredLevel: 14 },
  { itemName: 'Jade Ore', professionName: 'Mining', amount: 12, silver: 620, experience: 62, requiredLevel: 20 },
  { itemName: 'Crystal Cluster', professionName: 'Mining', amount: 8, silver: 760, experience: 76, requiredLevel: 24 },
  { itemName: 'Gold Dust', professionName: 'Mining', amount: 12, silver: 860, experience: 86, requiredLevel: 30 },
  { itemName: 'Fire Crystal', professionName: 'Mining', amount: 8, silver: 980, experience: 98, requiredLevel: 34 },
  { itemName: 'Dark Ore', professionName: 'Mining', amount: 10, silver: 1160, experience: 116, requiredLevel: 40 },

  // ------------------------------------------------------------- Fishing
  { itemName: 'Raw Fish', professionName: 'Fishing', amount: 6, silver: 115, experience: 12, requiredLevel: 1 },
  { itemName: 'Raw Fish', professionName: 'Fishing', amount: 12, silver: 235, experience: 24, requiredLevel: 1 },
  { itemName: 'Pink Shell', professionName: 'Fishing', amount: 8, silver: 175, experience: 17, requiredLevel: 1 },
  { itemName: 'Raw Fish', professionName: 'Fishing', amount: 20, silver: 400, experience: 40, requiredLevel: 3 },
  { itemName: 'Dried Fish', professionName: 'Fishing', amount: 10, silver: 420, experience: 42, requiredLevel: 10 },
  { itemName: 'Blue Shell', professionName: 'Fishing', amount: 8, silver: 350, experience: 35, requiredLevel: 12 },
  { itemName: 'Salmon Fillet', professionName: 'Fishing', amount: 10, silver: 620, experience: 62, requiredLevel: 20 },
  { itemName: 'Seaweed', professionName: 'Fishing', amount: 14, silver: 560, experience: 56, requiredLevel: 22 },
  { itemName: 'Tuna Fish', professionName: 'Fishing', amount: 10, silver: 870, experience: 87, requiredLevel: 30 },
  { itemName: 'Crab Legs', professionName: 'Fishing', amount: 8, silver: 940, experience: 94, requiredLevel: 34 },
  { itemName: 'White Coral', professionName: 'Fishing', amount: 8, silver: 1170, experience: 117, requiredLevel: 40 },

  // ----------------------------------------------------------- Herbalism
  { itemName: 'Green Herb', professionName: 'Herbalism', amount: 6, silver: 115, experience: 12, requiredLevel: 1 },
  { itemName: 'Green Herb', professionName: 'Herbalism', amount: 12, silver: 235, experience: 24, requiredLevel: 1 },
  { itemName: 'Herb Leaf', professionName: 'Herbalism', amount: 8, silver: 170, experience: 17, requiredLevel: 1 },
  { itemName: 'Wheat Bundle', professionName: 'Herbalism', amount: 10, silver: 210, experience: 21, requiredLevel: 3 },
  { itemName: 'Blue Herb', professionName: 'Herbalism', amount: 10, silver: 400, experience: 40, requiredLevel: 10 },
  { itemName: 'Carrot', professionName: 'Herbalism', amount: 12, silver: 380, experience: 38, requiredLevel: 12 },
  { itemName: 'Clover Herb', professionName: 'Herbalism', amount: 10, silver: 610, experience: 61, requiredLevel: 20 },
  { itemName: 'Rice Barrel', professionName: 'Herbalism', amount: 8, silver: 560, experience: 56, requiredLevel: 22 },
  { itemName: 'Azure Herb', professionName: 'Herbalism', amount: 10, silver: 870, experience: 87, requiredLevel: 30 },
  { itemName: 'Spice Pouch', professionName: 'Herbalism', amount: 8, silver: 800, experience: 80, requiredLevel: 32 },
  { itemName: 'Dragon Herb', professionName: 'Herbalism', amount: 8, silver: 1180, experience: 118, requiredLevel: 40 },
];

async function professionIdByName(name: string) {
  const profession = await prisma.profession.findUnique({ where: { name } });
  if (!profession) throw new Error(`no profession named "${name}" — seed professions first`);
  return profession.id;
}

export async function seedCommissions() {
  for (const { itemName, professionName, ...commission } of COMMISSIONS) {
    const itemId = await itemIdByName(itemName);
    const professionId = await professionIdByName(professionName);
    const data = { ...commission, itemId, professionId };
    await prisma.commission.upsert({
      where: { professionId_itemId_amount: { professionId, itemId, amount: commission.amount } },
      create: data,
      update: data,
    });
  }
  console.log(`commissions: ${COMMISSIONS.length}`);
}
