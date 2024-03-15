function isSuccess(chance: number): boolean {
  if (chance < 0 || chance > 100) {
    throw new Error('Chance must be between 0 and 100');
  }

  const randomNum = Math.random() * 100; // Generate a random number between 0 and 100
  return randomNum < chance;
}

function getRandomNumberBetween(min: number, max: number): number {
  if (min > max) {
    throw new Error('Min number must be less than or equal to max number');
  }

  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function calculateNextLevelExp(level: number) {
  return level * 100 * 1.2;
}
function getLevelFromExp(exp: number) {
  let level = 0;
  let expNeeded = 0;

  while (exp >= expNeeded) {
    expNeeded = calculateNextLevelExp(level);
    if (exp >= expNeeded) {
      level++;
    }
  }

  return level;
}

export const utils = {
  isSuccess,
  getRandomNumberBetween,
  calculateNextLevelExp,
  getLevelFromExp,
};
