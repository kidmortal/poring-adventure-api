import { Injectable, Logger } from '@nestjs/common';

import { BattleInstance, UserWithStats } from './battle';
import { MonstersService } from 'src/feature/monsters/monsters.service';
import { UsersService } from 'src/feature/users/users.service';
import { ItemsService } from 'src/feature/items/items.service';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { Cron } from '@nestjs/schedule';
import { PartyService } from 'src/feature/party/party.service';
import { BattleValidations } from './validators';
import { GuildService } from 'src/feature/guild/guild.service';
import { PrismaService } from 'src/core/prisma/prisma.service';

@Injectable()
export class BattleService {
  constructor(
    private readonly monsterService: MonstersService,
    private readonly userService: UsersService,
    private readonly partyService: PartyService,
    private readonly itemService: ItemsService,
    private readonly guildService: GuildService,
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
      const userData = await this.userService._getUserWithEmail({
        userEmail: args.userEmail,
      });
      if (userData.partyId) {
        const fullPartyInfo = await this.partyService.getPartyFromId({ partyId: userData.partyId });
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
      await this.prisma.$transaction(async (tx) => {
        await this.userService.decreaseUserBuffs({ userEmail, tx });
        await this.userService.addExpSilver({ userEmail, silver, exp, tx });
        await this.userService.levelUpUser({
          user: rewardUser,
          expGain: exp,
          tx,
        });
        await this.userService.updateUserHealthMana({
          userEmail,
          health: remainingHealth,
          mana: remainingMana,
          tx,
        });
        await this.guildService.contributeToGuildTask({
          userEmail,
          mapId,
          amount: monsterCount,
          tx,
        });

        for await (const { itemId, stack } of dropedItems) {
          await this.itemService.addItemToInventory({
            userEmail,
            itemId,
            stack,
            quality: 1,
            enhancement: 0,
            tx,
          });
        }
      });

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
