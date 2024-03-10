import { Drop, Item, Monster, Stats, User } from '@prisma/client';

export type MonsterWithDrops = Monster & {
  drops: DropWithItem[];
};

export type DropWithItem = Drop & {
  item: Item;
};

export type UserWithStats = User & {
  stats: Stats;
};

export type Battle = {
  user: UserWithStats;
  monster: MonsterWithDrops;
  attackerTurn: string;
  battleFinished: boolean;
  userLost: boolean;
  log: string[];
  drops: BattleDrop[];
};

export type BattleDrop = {
  userEmail: string;
  silver: number;
  dropedItems: BattleUserDropedItem[];
};

export type BattleUserDropedItem = {
  stack: number;
  itemId: number;
};
