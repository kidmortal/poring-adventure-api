import { MonsterWithDrops, UserWithStats } from './entities/battle';

function generateBattleAttackOrder(
  users: UserWithStats[],
  monsters: MonsterWithDrops[],
) {
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

export const BattleUtils = {
  generateBattleAttackOrder,
};
