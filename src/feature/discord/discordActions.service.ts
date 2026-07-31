import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { UsersService } from 'src/feature/users/users.service';
import { UsersRepository } from 'src/feature/users/users.repository';
import { ItemsService } from 'src/feature/items/items.service';
import { EquipmentService } from 'src/feature/items/equipment.service';
import { BattleService } from 'src/feature/battle/battle.service';
import { MonstersService } from 'src/feature/monsters/monsters.service';
import { GuildService } from 'src/feature/guild/guild.service';
import { GuildTaskService } from 'src/feature/guild/guildTask.service';
import { GuildApplicationService } from 'src/feature/guild/guildApplication.service';
import { MarketService } from 'src/feature/market/market.service';
import { PartyService } from 'src/feature/party/party.service';
import { MailService } from 'src/feature/mail/mail.service';
import { SkillsService } from 'src/feature/skills/skills.service';
import { DiscordService } from './discord.service';

/**
 * The discord bot connects with a single service socket, so it cannot use the
 * regular gateways — those read the acting user from `handshake.auth.email`.
 * Every method here takes a `discordId` instead, resolves it to the linked
 * account, and then calls the exact same service the web client would.
 */
@Injectable()
export class DiscordActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly discordService: DiscordService,
    private readonly usersService: UsersService,
    private readonly usersRepository: UsersRepository,
    private readonly itemsService: ItemsService,
    private readonly equipmentService: EquipmentService,
    private readonly battleService: BattleService,
    private readonly monstersService: MonstersService,
    private readonly guildService: GuildService,
    private readonly guildTaskService: GuildTaskService,
    private readonly guildApplicationService: GuildApplicationService,
    private readonly marketService: MarketService,
    private readonly partyService: PartyService,
    private readonly mailService: MailService,
    private readonly skillsService: SkillsService,
  ) {}

  private email(discordId: string) {
    return this.discordService.requireUserEmail({ discordId });
  }

  // ---------------------------------------------------------------- profile

  async getProfile(args: { discordId: string }) {
    return this.usersRepository.getFullUser({ userEmail: await this.email(args.discordId) });
  }

  async updateName(args: { discordId: string; newName: string }) {
    return this.usersService.updateUserName({ email: await this.email(args.discordId), newName: args.newName });
  }

  getRanking(args: { page: number }) {
    return this.usersService.getUsersPage({ page: args.page || 1 });
  }

  // -------------------------------------------------------------- inventory

  getInventory(args: { discordId: string }) {
    return this.discordService.inventory({ discordId: args.discordId });
  }

  async getEquipment(args: { discordId: string }) {
    const user = await this.usersRepository.getFullUser({ userEmail: await this.email(args.discordId) });
    return user?.inventory?.filter((item) => item.equipped) ?? [];
  }

  async equipItem(args: { discordId: string; inventoryId: number }) {
    return this.equipmentService.equipItem({
      userEmail: await this.email(args.discordId),
      inventoryId: args.inventoryId,
    });
  }

  async unequipItem(args: { discordId: string; inventoryId: number }) {
    return this.equipmentService.unequipItem({
      userEmail: await this.email(args.discordId),
      inventoryId: args.inventoryId,
    });
  }

  async consumeItem(args: { discordId: string; inventoryId: number }) {
    return this.itemsService.consumeItem({
      userEmail: await this.email(args.discordId),
      inventoryId: args.inventoryId,
      stack: 1,
    });
  }

  async enhanceItem(args: { discordId: string; inventoryId: number }) {
    return this.itemsService.enhanceItem({
      userEmail: await this.email(args.discordId),
      inventoryId: args.inventoryId,
    });
  }

  // ----------------------------------------------------------------- battle

  getBattle(args: { discordId: string }) {
    return this.discordService.getBattle({ discordId: args.discordId });
  }

  async createBattle(args: { discordId: string; mapId: number }) {
    const userEmail = await this.email(args.discordId);
    await this.battleService.create({ userEmail, mapId: args.mapId });
    return this.battleService.getUserBattle(userEmail)?.toJson() ?? false;
  }

  async attack(args: { discordId: string }) {
    const userEmail = await this.email(args.discordId);
    await this.battleService.attack(userEmail);
    return this.battleService.getUserBattle(userEmail)?.toJson() ?? false;
  }

  async cast(args: { discordId: string; skillId: number; targetName?: string }) {
    const userEmail = await this.email(args.discordId);
    await this.battleService.cast({ email: userEmail, skillId: args.skillId, targetName: args.targetName });
    return this.battleService.getUserBattle(userEmail)?.toJson() ?? false;
  }

  async finishBattle(args: { discordId: string }) {
    return this.battleService.finishBattle({ userEmail: await this.email(args.discordId) });
  }

  getMaps() {
    return this.monstersService.getAllMaps();
  }

  getMonstersFromMap(args: { mapId: number }) {
    return this.monstersService.findOneFromMap(args.mapId);
  }

  // ------------------------------------------------------------------ guild

  async getGuild(args: { discordId: string }) {
    return this.guildService.getGuildFromUser({ userEmail: await this.email(args.discordId) });
  }

  getAllGuilds() {
    return this.guildService.findAll();
  }

  async applyToGuild(args: { discordId: string; guildId: number }) {
    return this.guildApplicationService.applyToGuild({
      userEmail: await this.email(args.discordId),
      guildId: args.guildId,
    });
  }

  async acceptGuildApplication(args: { discordId: string; applicationId: number }) {
    return this.guildApplicationService.acceptGuildApplication({
      userEmail: await this.email(args.discordId),
      applicationId: args.applicationId,
    });
  }

  async refuseGuildApplication(args: { discordId: string; applicationId: number }) {
    return this.guildApplicationService.refuseGuildApplication({
      userEmail: await this.email(args.discordId),
      applicationId: args.applicationId,
    });
  }

  async quitGuild(args: { discordId: string }) {
    return this.guildService.quitFromGuild({ userEmail: await this.email(args.discordId) });
  }

  getGuildTasks() {
    return this.guildTaskService.findAllGuildTasks();
  }

  async acceptGuildTask(args: { discordId: string; taskId: number }) {
    return this.guildTaskService.acceptTask({ userEmail: await this.email(args.discordId), taskId: args.taskId });
  }

  async cancelGuildTask(args: { discordId: string }) {
    return this.guildTaskService.cancelCurrentTask({ userEmail: await this.email(args.discordId) });
  }

  async finishGuildTask(args: { discordId: string }) {
    return this.guildTaskService.finishCurrentTask({ userEmail: await this.email(args.discordId) });
  }

  // ----------------------------------------------------------------- market

  getMarketListings(args: { page: number; category: MarketCategory }) {
    return this.marketService.findAll({ page: args.page || 1, category: args.category || 'all' });
  }

  async createMarketListing(args: { discordId: string; inventoryId: number; price: number; stack: number }) {
    return this.marketService.addItemToMarket({
      sellerEmail: await this.email(args.discordId),
      inventoryId: args.inventoryId,
      price: args.price,
      stack: args.stack,
    });
  }

  async purchaseMarketListing(args: { discordId: string; marketListingId: number; stack: number }) {
    return this.marketService.purchase({
      buyerEmail: await this.email(args.discordId),
      marketListingId: args.marketListingId,
      stacks: args.stack,
    });
  }

  async removeMarketListing(args: { discordId: string; marketListingId: number }) {
    return this.marketService.remove({
      userEmail: await this.email(args.discordId),
      marketListingId: args.marketListingId,
    });
  }

  // ------------------------------------------------------------------ party

  async getParty(args: { discordId: string }) {
    const userEmail = await this.email(args.discordId);
    const partyId = await this._currentPartyId({ userEmail });
    if (!partyId) return null;
    return this.partyService.findOne({ partyId, email: userEmail });
  }

  async createParty(args: { discordId: string }) {
    return this.partyService.create({ email: await this.email(args.discordId) });
  }

  getOpenParties() {
    return this.partyService.getAllOpenParties();
  }

  async openParty(args: { discordId: string }) {
    const userEmail = await this.email(args.discordId);
    return this.partyService.openParty({ email: userEmail, partyId: await this._requirePartyId({ userEmail }) });
  }

  async closeParty(args: { discordId: string }) {
    const userEmail = await this.email(args.discordId);
    return this.partyService.closeParty({ email: userEmail, partyId: await this._requirePartyId({ userEmail }) });
  }

  async joinParty(args: { discordId: string; partyId: number }) {
    return this.partyService.joinParty({ email: await this.email(args.discordId), partyId: args.partyId });
  }

  async quitParty(args: { discordId: string }) {
    const userEmail = await this.email(args.discordId);
    return this.partyService.quitParty({ email: userEmail, partyId: await this._requirePartyId({ userEmail }) });
  }

  async removeParty(args: { discordId: string }) {
    const userEmail = await this.email(args.discordId);
    return this.partyService.remove({ userEmail, partyId: await this._requirePartyId({ userEmail }) });
  }

  /** Both sides are discord users here, so the target is resolved the same way. */
  async inviteToParty(args: { discordId: string; invitedDiscordId: string }) {
    const userEmail = await this.email(args.discordId);
    const invitedEmail = await this.email(args.invitedDiscordId);
    return this.partyService.invite({
      userEmail,
      invitedEmail,
      partyId: await this._requirePartyId({ userEmail }),
    });
  }

  async kickFromParty(args: { discordId: string; kickedDiscordId: string }) {
    const userEmail = await this.email(args.discordId);
    const kickedEmail = await this.email(args.kickedDiscordId);
    return this.partyService.kick({
      userEmail,
      kickedEmail,
      partyId: await this._requirePartyId({ userEmail }),
    });
  }

  async sendPartyMessage(args: { discordId: string; message: string }) {
    const userEmail = await this.email(args.discordId);
    return this.partyService.sendPartyChatMessage({
      partyId: await this._requirePartyId({ userEmail }),
      message: args.message,
    });
  }

  // ------------------------------------------------------------------- mail

  async getMail(args: { discordId: string }) {
    return this.mailService.findAll({ userEmail: await this.email(args.discordId) });
  }

  async claimMail(args: { discordId: string }) {
    return this.mailService.claimAll({ userEmail: await this.email(args.discordId) });
  }

  async viewMail(args: { discordId: string }) {
    return this.mailService.viewAll({ userEmail: await this.email(args.discordId) });
  }

  async deleteMail(args: { discordId: string }) {
    return this.mailService.deleteAll({ userEmail: await this.email(args.discordId) });
  }

  // ----------------------------------------------------------------- skills

  async getSkills(args: { discordId: string }) {
    const user = await this.usersRepository.getFullUser({ userEmail: await this.email(args.discordId) });
    return {
      learned: user?.learnedSkills ?? [],
      available: user?.profession?.skills ?? [],
    };
  }

  async learnSkill(args: { discordId: string; skillId: number }) {
    return this.skillsService.learn({ email: await this.email(args.discordId), skillId: args.skillId });
  }

  async equipSkill(args: { discordId: string; skillId: number }) {
    return this.skillsService.equip({ email: await this.email(args.discordId), skillId: args.skillId });
  }

  async unequipSkill(args: { discordId: string; skillId: number }) {
    return this.skillsService.unequip({ email: await this.email(args.discordId), skillId: args.skillId });
  }

  // ---------------------------------------------------------------- helpers

  private async _currentPartyId(args: { userEmail: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: args.userEmail },
      select: { partyId: true },
    });
    return user?.partyId ?? null;
  }

  private async _requirePartyId(args: { userEmail: string }) {
    const partyId = await this._currentPartyId(args);
    if (!partyId) {
      throw new BadRequestException('You are not in a party');
    }
    return partyId;
  }
}
