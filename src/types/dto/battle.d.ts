declare type BattleCreateDto = {
  mapId: number;
};

declare type BattleCastDto = {
  skillId: number;
  targetName?: string;
};

declare type BattleUseItemDto = {
  inventoryId: number;
};
