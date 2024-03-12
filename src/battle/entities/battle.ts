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
  users: UserWithStats[];
  monsters: MonsterWithDrops[];
  attackerTurn: number;
  attackerList: string[];
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
