/**
 * The commission board's contracts. Four are drawn per player per day, so what
 * matters is the payout of a *board*, not of a single row.
 *
 * The target is a supplement, not a replacement for grinding. Averaged over a
 * week of draws, a *full* board is worth roughly 350–800 silver at level 1,
 * around 1,000–1,250 by level 10, and 1,200–1,900 through the twenties where
 * most players sit.
 *
 * Those are ceilings, not incomes. Stamina is the real limit: a day's budget
 * buys five or six crafts, so the larger contracts are two-day jobs and nobody
 * clears a whole board in a morning. Actual take-home lands near half the
 * figures above, which is the point — a fighter should still out-earn a crafter.
 *
 * Each contract also has to be worth more than selling the same goods for
 * materials, or nobody fills it — the silver below is priced off the ingredients
 * plus the stamina the craft burns, with a margin on top for the crafter's time.
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
  // Every trade needs at least four contracts inside its first few levels, or a
  // new player opens the board to one lonely job and learns nothing about what
  // it is for. Low-level entries stay in the pool forever, which also keeps a
  // level-40 board from being nothing but its most expensive work.

  // Blacksmithing — the fewest, largest contracts, since its goods are the
  // slowest to make and the most valuable when they land.
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
  { itemName: 'Copper Ore', professionName: 'Blacksmithing', amount: 5, silver: 140, experience: 14, requiredLevel: 1 },
  {
    itemName: 'Bronze Sword',
    professionName: 'Blacksmithing',
    amount: 3,
    silver: 480,
    experience: 46,
    requiredLevel: 5,
  },
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
  {
    itemName: 'Copper Ore',
    professionName: 'Blacksmithing',
    amount: 10,
    silver: 220,
    experience: 22,
    requiredLevel: 1,
  },
  { itemName: 'Iron Ore', professionName: 'Blacksmithing', amount: 10, silver: 420, experience: 40, requiredLevel: 10 },
  {
    itemName: 'Silver Ore',
    professionName: 'Blacksmithing',
    amount: 10,
    silver: 620,
    experience: 60,
    requiredLevel: 20,
  },
  { itemName: 'Gold Ore', professionName: 'Blacksmithing', amount: 10, silver: 880, experience: 85, requiredLevel: 30 },
  {
    itemName: 'Demon Ore',
    professionName: 'Blacksmithing',
    amount: 8,
    silver: 1200,
    experience: 120,
    requiredLevel: 40,
  },

  // Cooking — meals are consumed, so these are the contracts that recur most
  // naturally and the ones that keep a fisherman in business.
  { itemName: 'Grilled Fish', professionName: 'Cooking', amount: 2, silver: 90, experience: 9, requiredLevel: 1 },
  { itemName: 'Grilled Fish', professionName: 'Cooking', amount: 3, silver: 130, experience: 13, requiredLevel: 1 },
  { itemName: 'Grilled Fish', professionName: 'Cooking', amount: 5, silver: 200, experience: 20, requiredLevel: 1 },
  { itemName: 'Raw Fish', professionName: 'Cooking', amount: 6, silver: 130, experience: 13, requiredLevel: 1 },
  { itemName: 'Grilled Fish', professionName: 'Cooking', amount: 10, silver: 440, experience: 45, requiredLevel: 5 },
  { itemName: 'Herb Stew', professionName: 'Cooking', amount: 5, silver: 460, experience: 45, requiredLevel: 10 },
  { itemName: 'Herb Stew', professionName: 'Cooking', amount: 10, silver: 1000, experience: 100, requiredLevel: 18 },
  { itemName: 'Spiced Roast', professionName: 'Cooking', amount: 5, silver: 760, experience: 75, requiredLevel: 20 },
  { itemName: 'Spiced Roast', professionName: 'Cooking', amount: 10, silver: 1650, experience: 160, requiredLevel: 28 },
  { itemName: 'Feast Platter', professionName: 'Cooking', amount: 3, silver: 1100, experience: 110, requiredLevel: 30 },
  { itemName: 'Feast Platter', professionName: 'Cooking', amount: 6, silver: 2400, experience: 240, requiredLevel: 40 },

  // Alchemy — bought in bulk and consumed under pressure, so its board leans on
  // volume rather than on any single expensive contract.
  { itemName: 'Healing Potion', professionName: 'Alchemy', amount: 2, silver: 95, experience: 9, requiredLevel: 1 },
  { itemName: 'Healing Potion', professionName: 'Alchemy', amount: 3, silver: 135, experience: 13, requiredLevel: 1 },
  { itemName: 'Healing Potion', professionName: 'Alchemy', amount: 5, silver: 210, experience: 20, requiredLevel: 1 },
  { itemName: 'Green Herb', professionName: 'Alchemy', amount: 6, silver: 130, experience: 13, requiredLevel: 1 },
  { itemName: 'Healing Potion', professionName: 'Alchemy', amount: 10, silver: 460, experience: 45, requiredLevel: 5 },
  { itemName: 'Mana Potion', professionName: 'Alchemy', amount: 5, silver: 230, experience: 22, requiredLevel: 2 },
  { itemName: 'Mana Potion', professionName: 'Alchemy', amount: 10, silver: 500, experience: 50, requiredLevel: 8 },
  { itemName: 'Escape Powder', professionName: 'Alchemy', amount: 6, silver: 520, experience: 50, requiredLevel: 10 },
  {
    itemName: 'Escape Powder',
    professionName: 'Alchemy',
    amount: 12,
    silver: 1120,
    experience: 110,
    requiredLevel: 20,
  },
  { itemName: 'Revive Draught', professionName: 'Alchemy', amount: 2, silver: 900, experience: 90, requiredLevel: 25 },
  {
    itemName: 'Revive Draught',
    professionName: 'Alchemy',
    amount: 5,
    silver: 2300,
    experience: 230,
    requiredLevel: 35,
  },

  // Gathering trades sell raw. The margins are thinner than a crafter's, which
  // is the point: a gatherer's best customer should be a crafter, not the NPC.
  { itemName: 'Copper Ore', professionName: 'Mining', amount: 6, silver: 120, experience: 12, requiredLevel: 1 },
  { itemName: 'Copper Ore', professionName: 'Mining', amount: 12, silver: 240, experience: 25, requiredLevel: 1 },
  { itemName: 'Copper Ore', professionName: 'Mining', amount: 20, silver: 410, experience: 42, requiredLevel: 3 },
  { itemName: 'Iron Ore', professionName: 'Mining', amount: 6, silver: 200, experience: 20, requiredLevel: 5 },
  { itemName: 'Iron Ore', professionName: 'Mining', amount: 12, silver: 400, experience: 40, requiredLevel: 10 },
  { itemName: 'Silver Ore', professionName: 'Mining', amount: 12, silver: 600, experience: 60, requiredLevel: 20 },
  { itemName: 'Gold Ore', professionName: 'Mining', amount: 12, silver: 850, experience: 85, requiredLevel: 30 },
  { itemName: 'Demon Ore', professionName: 'Mining', amount: 10, silver: 1150, experience: 115, requiredLevel: 40 },

  { itemName: 'Raw Fish', professionName: 'Fishing', amount: 6, silver: 115, experience: 12, requiredLevel: 1 },
  { itemName: 'Raw Fish', professionName: 'Fishing', amount: 12, silver: 230, experience: 25, requiredLevel: 1 },
  { itemName: 'Fish Scale', professionName: 'Fishing', amount: 6, silver: 130, experience: 13, requiredLevel: 1 },
  { itemName: 'Raw Fish', professionName: 'Fishing', amount: 20, silver: 395, experience: 40, requiredLevel: 3 },
  { itemName: 'Fish Scale', professionName: 'Fishing', amount: 12, silver: 260, experience: 28, requiredLevel: 5 },
  { itemName: 'Swamp Reed', professionName: 'Fishing', amount: 12, silver: 420, experience: 42, requiredLevel: 10 },
  { itemName: 'Raw Fish', professionName: 'Fishing', amount: 25, silver: 700, experience: 70, requiredLevel: 20 },
  { itemName: 'Fish Scale', professionName: 'Fishing', amount: 25, silver: 820, experience: 82, requiredLevel: 30 },

  { itemName: 'Green Herb', professionName: 'Herbalism', amount: 6, silver: 115, experience: 12, requiredLevel: 1 },
  { itemName: 'Green Herb', professionName: 'Herbalism', amount: 12, silver: 230, experience: 25, requiredLevel: 1 },
  { itemName: 'Green Herb', professionName: 'Herbalism', amount: 20, silver: 395, experience: 40, requiredLevel: 3 },
  { itemName: 'Blue Herb', professionName: 'Herbalism', amount: 6, silver: 200, experience: 20, requiredLevel: 5 },
  { itemName: 'Blue Herb', professionName: 'Herbalism', amount: 12, silver: 410, experience: 41, requiredLevel: 10 },
  { itemName: 'Grave Moss', professionName: 'Herbalism', amount: 12, silver: 610, experience: 61, requiredLevel: 20 },
  { itemName: 'Sun Blossom', professionName: 'Herbalism', amount: 12, silver: 860, experience: 86, requiredLevel: 30 },
  { itemName: 'Void Bloom', professionName: 'Herbalism', amount: 10, silver: 1170, experience: 117, requiredLevel: 40 },
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
