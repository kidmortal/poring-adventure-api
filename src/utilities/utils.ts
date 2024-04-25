function isSuccess(chance: number): boolean {
  if (chance < 0 || chance > 100) {
    throw new Error('Chance must be between 0 and 100');
  }

  const randomNum = Math.random() * 100; // Generate a random number between 0 and 100
  return randomNum < chance;
}

function enhanceChance(enhanceLevel: number): number {
  let currentChance = 100;
  for (let index = 0; index < enhanceLevel; index++) {
    currentChance -= Math.round(currentChance * 0.1);
  }
  return currentChance;
}

function itemStatsMultiplier(quality: number, enhancement: number) {
  return 1 + enhancement * 0.2 * (quality * 0.5);
}

function enhancePrice(enhanceLevel: number): number {
  let currentPrice = 100;
  for (let index = 0; index < enhanceLevel; index++) {
    currentPrice += Math.round(currentPrice * 0.5);
  }
  return currentPrice;
}

function randomDamage(value: number, oscillationPercentage: number): number {
  // Calculate the minimum and maximum values based on the oscillation percentage
  const min = value - Math.round((value * oscillationPercentage) / 100);
  const max = value + Math.round((value * oscillationPercentage) / 100);

  // Generate a random number within the range [min, max] and round it
  return Math.round(Math.random() * (max - min) + min);
}
function getRandomNumberBetween(min: number, max: number): number {
  if (min > max) {
    throw new Error('Min number must be less than or equal to max number');
  }

  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getLevelFromExp(exp: number) {
  let level = 1;
  let expNeeded = 0;
  let currentExp = 0;

  while (exp >= currentExp) {
    expNeeded = level * 100;
    currentExp += expNeeded;
    if (exp >= currentExp) {
      level++;
    }
  }

  return level;
}

function removeElementFromList<T>(args: { list: T[]; element: T }): boolean {
  const index = args.list.indexOf(args.element);
  if (index !== -1) {
    args.list.splice(index, 1);
    return true;
  }
  return false;
}
function formatMemory(memory?: number) {
  if (!memory) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];

  let index = 0;
  let value = memory;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index++;
  }

  return `${value.toFixed(2)} ${units[index]}`;
}

export const Utils = {
  isSuccess,
  enhanceChance,
  enhancePrice,
  getRandomNumberBetween,
  getLevelFromExp,
  randomDamage,
  removeElementFromList,
  formatMemory,
  itemStatsMultiplier,
};
