import { UsersRepository } from 'src/feature/users/users.repository';
import { UserWalletService } from 'src/feature/users/userWallet.service';
import { UserStatsService } from 'src/feature/users/userStats.service';
import { Injectable, Logger } from '@nestjs/common';

import { BattleInstance, UserWithStats } from './battle';
import { MonstersService } from 'src/feature/monsters/monsters.service';
import { UsersService } from 'src/feature/users/users.service';
import { InventoryService } from 'src/feature/items/inventory.service';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { Cron } from '@nestjs/schedule';
import { PartyService } from 'src/feature/party/party.service';
import { PartyRepository } from 'src/feature/party/party.repository';
import { BattleValidations } from './validators';
import { GuildService } from 'src/feature/guild/guild.service';
import { GuildTaskService } from 'src/feature/guild/guildTask.service';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { TRANSACTION_OPTIONS } from 'src/core/prisma/types/prisma';

@Injectable()
export class BattleService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly userWallet: UserWalletService,
    private readonly userStats: UserStatsService,
    private readonly monsterService: MonstersService,
    private readonly userService: UsersService,
    private readonly partyService: PartyService,
    private readonly partyRepository: PartyRepository,
    private readonly inventory: InventoryService,
    private readonly guildService: GuildService,
    private readonly guildTaskService: GuildTaskService,
    private readonly prisma: PrismaService,
    private readonly socket: WebsocketService,
  ) {}
  private battleList: BattleInstance[] = [];
  private logger = new Logger('Battle');

  @Cron('*/3 * * * * *')
  private autoRun() {
    this.battleList.forEach((b) => b.tickBattle());
  }

  async getBattleFromUser(email: string) {
    const battle = this.getUserBattle(email);
    if (battle) {
      this.logger.debug(`Notifying party about updates`);
      battle.notifyUsers();
      return true;
    }
    return false;
  }

  async create(args: { userEmail: string; mapId: number }) {
    const battle = this.getUserBattle(args.userEmail);

    if (!battle) {
      let users: UserWithStats[] = [];
      const userData = await this.usersRepository.getFullUser({
        userEmail: args.userEmail,
      });
      if (userData.partyId) {
        const fullPartyInfo = await this.partyRepository.getPartyFromId({ partyId: userData.partyId });
        const partyMembers = fullPartyInfo.members;
        users = partyMembers;
      } else {
        users = [userData];
      }
      const monsterData = await this.monsterService.findOneFromMap(args.mapId);

      const monsters = [monsterData];
      const newBattleInstance: BattleInstance = new BattleInstance({
        socket: this.socket,
        users: users,
        monsters: monsters,
        updateUsers: (b) => this.updateStatsAndRewards(b),
        removeBattle: () => this._remove(args.userEmail),
      });
      BattleValidations.validateBattleInstanceStart(newBattleInstance);

      newBattleInstance.notifyUsers();
      this.battleList.push(newBattleInstance);
      return true;
    }
    battle.notifyUsers();

    return true;
  }

  async finishBattle(args: { userEmail: string }) {
    const battle = this.getUserBattle(args.userEmail);
    if (battle) {
      battle.removeBattle();
      battle.notifyBattleRemoved();
      return true;
    }
    return false;
  }

  private async _remove(userEmail: string) {
    const battleIndex = this.battleList.findIndex((battle) => battle.hasUser(userEmail));

    if (battleIndex >= 0) {
      const removedBattle = this.battleList.splice(battleIndex, 1);
      if (removedBattle[0]) {
        removedBattle[0].notifyBattleRemoved();
      }

      return true;
    }
    return false;
  }

  async attack(userEmail: string) {
    const battle = this.getUserBattle(userEmail);
    if (!battle) return false;
    if (battle.battleFinished) return false;
    battle.processUserAttack({ email: userEmail });
    return true;
  }
  async cast(args: { email: string; skillId: number; targetName: string }) {
    const battle = this.getUserBattle(args.email);
    if (!battle) return false;
    if (battle.battleFinished) return false;
    battle.processUserCast(args);
    return true;
  }

  private async updateStatsAndRewards(battle: BattleInstance) {
    this.logger.log('Battle finished, giving rewards');
    this.logger.log(JSON.stringify(battle.droppedItems));
    for await (const { userEmail, silver, dropedItems, exp } of battle.droppedItems) {
      const monsterCount = battle.monsterCount;
      const mapId = battle.monstersMapId;
      const rewardUser = battle.getUserFromBattle(userEmail);
      const remainingHealth = rewardUser.stats.health;
      const remainingMana = rewardUser.stats.mana;
      // The database is remote, so a dozen sequential writes can outrun the
      // default five second interactive budget.
      let contributedGuildId: number | null = null;
      await this.prisma.$transaction(async (tx) => {
        await this.userStats.decreaseUserBuffs({ userEmail, tx });
        await this.userWallet.addExpSilver({ userEmail, silver, exp, tx });
        await this.userStats.levelUpUser({
          user: rewardUser,
          expGain: exp,
          tx,
        });
        await this.userStats.updateUserHealthMana({
          userEmail,
          health: remainingHealth,
          mana: remainingMana,
          tx,
        });
        contributedGuildId = await this.guildTaskService.contributeToGuildTask({
          userEmail,
          mapId,
          amount: monsterCount,
          tx,
        });

        for await (const { itemId, stack } of dropedItems) {
          await this.inventory.addItemToInventory({
            userEmail,
            itemId,
            stack,
            quality: 1,
            enhancement: 0,
            tx,
          });
        }
      }, TRANSACTION_OPTIONS);

      // Both re-read and push, so they wait until the rewards are committed.
      if (contributedGuildId) {
        await this.guildTaskService.refreshGuild(contributedGuildId);
      }
      await this.userService.notifyUserUpdateWithProfile({ email: userEmail });
    }
  }

  getUserBattle(userEmail: string): BattleInstance | undefined {
    let userBattle = undefined;
    if (!userEmail) return userBattle;
    this.battleList.forEach((onGoingBattle) => {
      const hasUser = onGoingBattle.hasUser(userEmail);
      if (hasUser) {
        userBattle = onGoingBattle;
      }
    });

    return userBattle;
  }
}
