import { Injectable, Logger } from '@nestjs/common';

import { BattleInstance, UserWithStats } from './battle';
import { MonstersService } from 'src/monsters/monsters.service';
import { UsersService } from 'src/users/users.service';
import { ItemsService } from 'src/items/items.service';
import { WebsocketService } from 'src/websocket/websocket.service';
import { Cron } from '@nestjs/schedule';
import { PartyService } from 'src/party/party.service';

@Injectable()
export class BattleService {
  constructor(
    private readonly monsterService: MonstersService,
    private readonly userService: UsersService,
    private readonly partyService: PartyService,
    private readonly itemService: ItemsService,
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

  async create(userEmail: string) {
    const battle = this.getUserBattle(userEmail);

    if (!battle) {
      let users: UserWithStats[] = [];
      const userData = await this.userService.findOne(userEmail);
      if (userData.partyId) {
        const fullPartyInfo = await this.partyService.getFullParty(
          userData.email,
        );
        const partyMembers = fullPartyInfo.members;
        users = partyMembers;
      } else {
        users = [userData];
      }
      const monsterData = await this.monsterService.findOne();

      const monsters = [monsterData];
      const newBattleInstance: BattleInstance = new BattleInstance({
        socket: this.socket,
        users: users,
        monsters: monsters,
        updateUsers: (b) => this.updateStatsAndRewards(b),
      });

      newBattleInstance.notifyUsers();
      this.battleList.push(newBattleInstance);
      return true;
    }
    battle.notifyUsers();

    return true;
  }

  async remove(userEmail: string) {
    const battleIndex = this.battleList.findIndex((battle) =>
      battle.hasUser(userEmail),
    );

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
  async cast(args: { email: string; skillId: number }) {
    const battle = this.getUserBattle(args.email);
    if (!battle) return false;
    if (battle.battleFinished) return false;
    battle.processUserCast(args);
    return true;
  }

  private async updateStatsAndRewards(battle: BattleInstance) {
    this.logger.log('Battle finished, giving rewards');
    this.logger.log(JSON.stringify(battle.droppedItems));
    for await (const {
      userEmail,
      silver,
      dropedItems,
      exp,
    } of battle.droppedItems) {
      const rewardUser = battle.getUserFromBattle(userEmail);
      const remainingHealth = rewardUser.stats.health;
      const remainingMana = rewardUser.stats.mana;
      await this.userService.decreaseUserBuffs({ userEmail });
      await this.userService.addExpSilver({ userEmail, silver, exp });
      await this.userService.levelUpUser({ user: rewardUser, expGain: exp });
      await this.userService.updateUserHealthMana({
        userEmail,
        health: remainingHealth,
        mana: remainingMana,
      });

      for await (const { itemId, stack } of dropedItems) {
        await this.itemService.addItemToUser({ userEmail, itemId, stack });
      }
      await this.userService.notifyUserUpdateWithProfile({ email: userEmail });
    }
  }

  private getUserBattle(userEmail: string): BattleInstance | undefined {
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
