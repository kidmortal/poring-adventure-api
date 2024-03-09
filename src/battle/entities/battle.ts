import { Monster, User } from '@prisma/client';

export type Battle = {
  user: User;
  monster: Monster;
  log: string[];
};
