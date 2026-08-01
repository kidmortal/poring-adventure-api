import { WebSocketGateway, SubscribeMessage, MessageBody } from '@nestjs/websockets';

import { Logger, UseFilters, UseGuards } from '@nestjs/common';
import { WebsocketExceptionsFilter } from 'src/core/websocket/websocketException.filter';
import { DiscordService } from './discord.service';
import { WebsocketAuthEmailGuard, WebsocketDiscordServiceGuard } from 'src/core/websocket/websocket.guard';
import { DiscordActionsService } from './discordActions.service';

/**
 * Everything the bot calls on behalf of a player. Each event names the acting
 * `discordId`, so the guard restricting this gateway to the bot's own socket is
 * the only thing standing between a player and someone else's account.
 */
@UseGuards(WebsocketAuthEmailGuard, WebsocketDiscordServiceGuard)
@UseFilters(WebsocketExceptionsFilter)
@WebSocketGateway({ cors: true })
export class DiscordBotGateway {
  constructor(
    private readonly discordService: DiscordService,
    private readonly actions: DiscordActionsService,
  ) {}
  private logger = new Logger('Websocket - discord bot');

  @SubscribeMessage('register_discord_profile')
  async registerDiscord(@MessageBody() dto: RegisterDiscordProfileDto) {
    this.logger.debug(`'register_discord_profile' ${dto?.id}`);
    if (!dto?.id) return false;
    const user = await this.discordService.register(dto);
    return user;
  }

  @SubscribeMessage('get_discord_battle')
  async getDiscordBattle(@MessageBody() dto: GetDiscordBattleDto) {
    this.logger.debug(`get_discord_battle`);
    return this.discordService.getBattle({ discordId: dto.discordId });
  }

  @SubscribeMessage('get_discord_user')
  async findOne(@MessageBody() dto: GetDiscordUserDto) {
    this.logger.debug(`'get_discord_user' ${dto.discordId}`);
    if (!dto.discordId) return false;

    const user = await this.discordService.findOne({ discordId: dto.discordId });
    return user;
  }

  @SubscribeMessage('get_discord_user_inventory')
  async getUserInventory(@MessageBody() discordId: string) {
    this.logger.debug(`'get_discord_user_inventory' ${discordId}`);
    if (!discordId) return false;

    return this.discordService.inventory({ discordId });
  }

  // ---------------------------------------------------------------- profile

  @SubscribeMessage('discord_get_profile')
  getProfile(@MessageBody() dto: DiscordActionDto) {
    this.logger.debug(`discord_get_profile ${dto.discordId}`);
    return this.actions.getProfile(dto);
  }

  @SubscribeMessage('discord_update_name')
  updateName(@MessageBody() dto: DiscordUpdateNameDto) {
    this.logger.debug(`discord_update_name ${dto.discordId}`);
    return this.actions.updateName(dto);
  }

  @SubscribeMessage('discord_get_ranking')
  getRanking(@MessageBody() dto: DiscordPageDto) {
    this.logger.debug('discord_get_ranking');
    return this.actions.getRanking(dto);
  }

  // -------------------------------------------------------------- inventory

  @SubscribeMessage('discord_get_inventory')
  getInventory(@MessageBody() dto: DiscordActionDto) {
    this.logger.debug(`discord_get_inventory ${dto.discordId}`);
    return this.actions.getInventory(dto);
  }

  @SubscribeMessage('discord_get_equipment')
  getEquipment(@MessageBody() dto: DiscordActionDto) {
    this.logger.debug(`discord_get_equipment ${dto.discordId}`);
    return this.actions.getEquipment(dto);
  }

  @SubscribeMessage('discord_equip_item')
  equipItem(@MessageBody() dto: DiscordInventoryItemDto) {
    this.logger.debug(`discord_equip_item ${dto.discordId}`);
    return this.actions.equipItem(dto);
  }

  @SubscribeMessage('discord_unequip_item')
  unequipItem(@MessageBody() dto: DiscordInventoryItemDto) {
    this.logger.debug(`discord_unequip_item ${dto.discordId}`);
    return this.actions.unequipItem(dto);
  }

  @SubscribeMessage('discord_consume_item')
  consumeItem(@MessageBody() dto: DiscordInventoryItemDto) {
    this.logger.debug(`discord_consume_item ${dto.discordId}`);
    return this.actions.consumeItem(dto);
  }

  @SubscribeMessage('discord_enhance_item')
  enhanceItem(@MessageBody() dto: DiscordInventoryItemDto) {
    this.logger.debug(`discord_enhance_item ${dto.discordId}`);
    return this.actions.enhanceItem(dto);
  }

  // ----------------------------------------------------------------- battle

  @SubscribeMessage('discord_battle_create')
  createBattle(@MessageBody() dto: DiscordBattleCreateDto) {
    this.logger.debug(`discord_battle_create ${dto.discordId}`);
    return this.actions.createBattle(dto);
  }

  @SubscribeMessage('discord_battle_attack')
  attack(@MessageBody() dto: DiscordActionDto) {
    this.logger.debug(`discord_battle_attack ${dto.discordId}`);
    return this.actions.attack(dto);
  }

  @SubscribeMessage('discord_battle_cast')
  cast(@MessageBody() dto: DiscordBattleCastDto) {
    this.logger.debug(`discord_battle_cast ${dto.discordId}`);
    return this.actions.cast(dto);
  }

  @SubscribeMessage('discord_battle_reset')
  finishBattle(@MessageBody() dto: DiscordActionDto) {
    this.logger.debug(`discord_battle_reset ${dto.discordId}`);
    return this.actions.finishBattle(dto);
  }

  @SubscribeMessage('discord_get_maps')
  getMaps() {
    this.logger.debug('discord_get_maps');
    return this.actions.getMaps();
  }

  @SubscribeMessage('discord_get_map_monsters')
  getMonstersFromMap(@MessageBody() dto: DiscordMapDto) {
    this.logger.debug('discord_get_map_monsters');
    return this.actions.getMonstersFromMap(dto);
  }

  // ------------------------------------------------------------------ guild

  @SubscribeMessage('discord_get_guild')
  getGuild(@MessageBody() dto: DiscordActionDto) {
    this.logger.debug(`discord_get_guild ${dto.discordId}`);
    return this.actions.getGuild(dto);
  }

  @SubscribeMessage('discord_get_all_guilds')
  getAllGuilds() {
    this.logger.debug('discord_get_all_guilds');
    return this.actions.getAllGuilds();
  }

  @SubscribeMessage('discord_apply_to_guild')
  applyToGuild(@MessageBody() dto: DiscordGuildDto) {
    this.logger.debug(`discord_apply_to_guild ${dto.discordId}`);
    return this.actions.applyToGuild(dto);
  }

  @SubscribeMessage('discord_accept_guild_application')
  acceptGuildApplication(@MessageBody() dto: DiscordGuildApplicationDto) {
    this.logger.debug(`discord_accept_guild_application ${dto.discordId}`);
    return this.actions.acceptGuildApplication(dto);
  }

  @SubscribeMessage('discord_refuse_guild_application')
  refuseGuildApplication(@MessageBody() dto: DiscordGuildApplicationDto) {
    this.logger.debug(`discord_refuse_guild_application ${dto.discordId}`);
    return this.actions.refuseGuildApplication(dto);
  }

  @SubscribeMessage('discord_quit_guild')
  quitGuild(@MessageBody() dto: DiscordActionDto) {
    this.logger.debug(`discord_quit_guild ${dto.discordId}`);
    return this.actions.quitGuild(dto);
  }

  @SubscribeMessage('discord_get_guild_tasks')
  getGuildTasks() {
    this.logger.debug('discord_get_guild_tasks');
    return this.actions.getGuildTasks();
  }

  @SubscribeMessage('discord_accept_guild_task')
  acceptGuildTask(@MessageBody() dto: DiscordGuildTaskDto) {
    this.logger.debug(`discord_accept_guild_task ${dto.discordId}`);
    return this.actions.acceptGuildTask(dto);
  }

  @SubscribeMessage('discord_cancel_guild_task')
  cancelGuildTask(@MessageBody() dto: DiscordActionDto) {
    this.logger.debug(`discord_cancel_guild_task ${dto.discordId}`);
    return this.actions.cancelGuildTask(dto);
  }

  @SubscribeMessage('discord_finish_guild_task')
  finishGuildTask(@MessageBody() dto: DiscordActionDto) {
    this.logger.debug(`discord_finish_guild_task ${dto.discordId}`);
    return this.actions.finishGuildTask(dto);
  }

  // ----------------------------------------------------------------- market

  @SubscribeMessage('discord_get_market')
  getMarketListings(@MessageBody() dto: DiscordMarketPageDto) {
    this.logger.debug('discord_get_market');
    return this.actions.getMarketListings(dto);
  }

  @SubscribeMessage('discord_create_market_listing')
  createMarketListing(@MessageBody() dto: DiscordCreateMarketListingDto) {
    this.logger.debug(`discord_create_market_listing ${dto.discordId}`);
    return this.actions.createMarketListing(dto);
  }

  @SubscribeMessage('discord_purchase_market_listing')
  purchaseMarketListing(@MessageBody() dto: DiscordPurchaseMarketListingDto) {
    this.logger.debug(`discord_purchase_market_listing ${dto.discordId}`);
    return this.actions.purchaseMarketListing(dto);
  }

  @SubscribeMessage('discord_remove_market_listing')
  removeMarketListing(@MessageBody() dto: DiscordRemoveMarketListingDto) {
    this.logger.debug(`discord_remove_market_listing ${dto.discordId}`);
    return this.actions.removeMarketListing(dto);
  }

  // ------------------------------------------------------------------ party

  @SubscribeMessage('discord_get_party')
  getParty(@MessageBody() dto: DiscordActionDto) {
    this.logger.debug(`discord_get_party ${dto.discordId}`);
    return this.actions.getParty(dto);
  }

  @SubscribeMessage('discord_create_party')
  createParty(@MessageBody() dto: DiscordActionDto) {
    this.logger.debug(`discord_create_party ${dto.discordId}`);
    return this.actions.createParty(dto);
  }

  @SubscribeMessage('discord_get_open_parties')
  getOpenParties() {
    this.logger.debug('discord_get_open_parties');
    return this.actions.getOpenParties();
  }

  @SubscribeMessage('discord_open_party')
  openParty(@MessageBody() dto: DiscordActionDto) {
    this.logger.debug(`discord_open_party ${dto.discordId}`);
    return this.actions.openParty(dto);
  }

  @SubscribeMessage('discord_close_party')
  closeParty(@MessageBody() dto: DiscordActionDto) {
    this.logger.debug(`discord_close_party ${dto.discordId}`);
    return this.actions.closeParty(dto);
  }

  @SubscribeMessage('discord_join_party')
  joinParty(@MessageBody() dto: DiscordJoinPartyDto) {
    this.logger.debug(`discord_join_party ${dto.discordId}`);
    return this.actions.joinParty(dto);
  }

  @SubscribeMessage('discord_quit_party')
  quitParty(@MessageBody() dto: DiscordActionDto) {
    this.logger.debug(`discord_quit_party ${dto.discordId}`);
    return this.actions.quitParty(dto);
  }

  @SubscribeMessage('discord_remove_party')
  removeParty(@MessageBody() dto: DiscordActionDto) {
    this.logger.debug(`discord_remove_party ${dto.discordId}`);
    return this.actions.removeParty(dto);
  }

  @SubscribeMessage('discord_invite_to_party')
  inviteToParty(@MessageBody() dto: DiscordInviteToPartyDto) {
    this.logger.debug(`discord_invite_to_party ${dto.discordId}`);
    return this.actions.inviteToParty(dto);
  }

  @SubscribeMessage('discord_kick_from_party')
  kickFromParty(@MessageBody() dto: DiscordKickFromPartyDto) {
    this.logger.debug(`discord_kick_from_party ${dto.discordId}`);
    return this.actions.kickFromParty(dto);
  }

  @SubscribeMessage('discord_send_party_message')
  sendPartyMessage(@MessageBody() dto: DiscordPartyMessageDto) {
    this.logger.debug(`discord_send_party_message ${dto.discordId}`);
    return this.actions.sendPartyMessage(dto);
  }

  // ------------------------------------------------------------------- mail

  @SubscribeMessage('discord_get_mail')
  getMail(@MessageBody() dto: DiscordActionDto) {
    this.logger.debug(`discord_get_mail ${dto.discordId}`);
    return this.actions.getMail(dto);
  }

  @SubscribeMessage('discord_claim_mail')
  claimMail(@MessageBody() dto: DiscordActionDto) {
    this.logger.debug(`discord_claim_mail ${dto.discordId}`);
    return this.actions.claimMail(dto);
  }

  @SubscribeMessage('discord_view_mail')
  viewMail(@MessageBody() dto: DiscordActionDto) {
    this.logger.debug(`discord_view_mail ${dto.discordId}`);
    return this.actions.viewMail(dto);
  }

  @SubscribeMessage('discord_delete_mail')
  deleteMail(@MessageBody() dto: DiscordActionDto) {
    this.logger.debug(`discord_delete_mail ${dto.discordId}`);
    return this.actions.deleteMail(dto);
  }

  // ----------------------------------------------------------------- skills

  @SubscribeMessage('discord_get_skills')
  getSkills(@MessageBody() dto: DiscordActionDto) {
    this.logger.debug(`discord_get_skills ${dto.discordId}`);
    return this.actions.getSkills(dto);
  }

  @SubscribeMessage('discord_learn_skill')
  learnSkill(@MessageBody() dto: DiscordSkillDto) {
    this.logger.debug(`discord_learn_skill ${dto.discordId}`);
    return this.actions.learnSkill(dto);
  }

  @SubscribeMessage('discord_equip_skill')
  equipSkill(@MessageBody() dto: DiscordSkillDto) {
    this.logger.debug(`discord_equip_skill ${dto.discordId}`);
    return this.actions.equipSkill(dto);
  }

  @SubscribeMessage('discord_unequip_skill')
  unequipSkill(@MessageBody() dto: DiscordSkillDto) {
    this.logger.debug(`discord_unequip_skill ${dto.discordId}`);
    return this.actions.unequipSkill(dto);
  }

  // ------------------------------------------------------------ professions

  @SubscribeMessage('discord_get_all_professions')
  getAllProfessions() {
    this.logger.debug('discord_get_all_professions');
    return this.actions.getAllProfessions();
  }

  @SubscribeMessage('discord_get_professions')
  getProfessions(@MessageBody() dto: DiscordActionDto) {
    this.logger.debug(`discord_get_professions ${dto.discordId}`);
    return this.actions.getProfessions(dto);
  }

  @SubscribeMessage('discord_learn_profession')
  learnProfession(@MessageBody() dto: DiscordProfessionDto) {
    this.logger.debug(`discord_learn_profession ${dto.discordId}`);
    return this.actions.learnProfession(dto);
  }

  @SubscribeMessage('discord_get_gathering_nodes')
  getGatheringNodes() {
    this.logger.debug('discord_get_gathering_nodes');
    return this.actions.getGatheringNodes();
  }

  @SubscribeMessage('discord_gather')
  gather(@MessageBody() dto: DiscordGatherDto) {
    this.logger.debug(`discord_gather ${dto.discordId}`);
    return this.actions.gather(dto);
  }

  @SubscribeMessage('discord_get_recipes')
  getRecipes() {
    this.logger.debug('discord_get_recipes');
    return this.actions.getRecipes();
  }

  @SubscribeMessage('discord_craft')
  craft(@MessageBody() dto: DiscordCraftDto) {
    this.logger.debug(`discord_craft ${dto.discordId}`);
    return this.actions.craft(dto);
  }
}
