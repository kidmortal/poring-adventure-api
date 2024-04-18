function isSuccess(chance: number): boolean {
  if (chance < 0 || chance > 100) {
    throw new Error('Chance must be between 0 and 100');
  }

  const randomNum = Math.random() * 100; // Generate a random number between 0 and 100
  return randomNum < chance;
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

export const utils = {
  isSuccess,
  getRandomNumberBetween,
  getLevelFromExp,
  randomDamage,
  removeElementFromList,
};
