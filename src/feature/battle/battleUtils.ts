import { MonsterWithDrops, UserWithStats } from './battle';

function generateBattleAttackOrder(users: UserWithStats[], monsters: MonsterWithDrops[]) {
  const mixedArray: string[] = [];

  const maxLength = Math.max(users.length, monsters.length);

  for (let i = 0; i < maxLength; i++) {
    if (i < users.length) {
      mixedArray.push(users[i].name);
    }
    if (i < monsters.length) {
      mixedArray.push(monsters[i].name);
    }
  }

  return mixedArray;
}

/**
 * A monster that has been left standing too long hits harder with every swing,
 * so a fight it cannot win outright still ends. `stacks` is how many times it
 * has already attacked while enraged — the first enraged hit is the plain one.
 */
function enragedDamage(baseDamage: number, stacks: number, multiplier: number) {
  if (stacks <= 0) return baseDamage;
  return Math.floor(baseDamage * Math.pow(multiplier, stacks));
}

export const BattleUtils = {
  generateBattleAttackOrder,
  enragedDamage,
};
