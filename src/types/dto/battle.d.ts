declare type BattleCreateDto = {
  mapId: number;
};

/** A plain swing. `targetName` is the monster the player picked, if any. */
declare type BattleAttackDto = {
  targetName?: string;
};

declare type BattleCastDto = {
  skillId: number;
  targetName?: string;
};

declare type BattleUseItemDto = {
  inventoryId: number;
};
