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

export const utils = {
  isSuccess,
  getRandomNumberBetween,
};
