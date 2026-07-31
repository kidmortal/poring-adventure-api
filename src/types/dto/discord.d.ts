declare type RegisterDiscordProfileDto = {
  name: string;
  id: string;
  url: string;
  token: string;
};

declare type GetDiscordBattleDto = {
  discordId: string;
};
declare type GetDiscordUserDto = {
  discordId: string;
};

declare type MarketCategory = 'all' | 'equipment' | 'consumable' | 'material';

/** Every discord action carries the id of the acting discord user. */
declare type DiscordActionDto = {
  discordId: string;
};

declare type DiscordUpdateNameDto = DiscordActionDto & { newName: string };
declare type DiscordPageDto = { page: number };
declare type DiscordInventoryItemDto = DiscordActionDto & { inventoryId: number };
declare type DiscordBattleCreateDto = DiscordActionDto & { mapId: number };
declare type DiscordBattleCastDto = DiscordActionDto & { skillId: number; targetName?: string };
declare type DiscordMapDto = { mapId: number };
declare type DiscordGuildDto = DiscordActionDto & { guildId: number };
declare type DiscordGuildApplicationDto = DiscordActionDto & { applicationId: number };
declare type DiscordGuildTaskDto = DiscordActionDto & { taskId: number };
declare type DiscordMarketPageDto = { page: number; category: MarketCategory };
declare type DiscordCreateMarketListingDto = DiscordActionDto & {
  inventoryId: number;
  price: number;
  stack: number;
};
declare type DiscordPurchaseMarketListingDto = DiscordActionDto & { marketListingId: number; stack: number };
declare type DiscordRemoveMarketListingDto = DiscordActionDto & { marketListingId: number };
declare type DiscordJoinPartyDto = DiscordActionDto & { partyId: number };
declare type DiscordInviteToPartyDto = DiscordActionDto & { invitedDiscordId: string };
declare type DiscordKickFromPartyDto = DiscordActionDto & { kickedDiscordId: string };
declare type DiscordPartyMessageDto = DiscordActionDto & { message: string };
declare type DiscordSkillDto = DiscordActionDto & { skillId: number };
