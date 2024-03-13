import { Injectable, Logger } from '@nestjs/common';

import { BattleInstance, UserWithStats } from './entities/battle';
import { MonstersService } from 'src/monsters/monsters.service';
import { UsersService } from 'src/users/users.service';
import { ItemsService } from 'src/items/items.service';
import { WebsocketService } from 'src/websocket/websocket.service';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class BattleService {
  constructor(
    private readonly monsterService: MonstersService,
    private readonly userService: UsersService,
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
        const fullPartyInfo = await this.userService.getFullParty(
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
    const didAttack = await battle.processUserAttack({
      email: userEmail,
    });
    if (didAttack) {
      const didBattleFinish = await this.settleBattleAndProcessRewards(battle);
      if (didBattleFinish) return true;
    }
    return false;
  }

  private async settleBattleAndProcessRewards(battle: BattleInstance) {
    const monsterAlive = battle.isMonsterAlive;
    const userAlive = battle.isPlayerAlive;
    if (monsterAlive && userAlive) {
      battle.notifyUsers();
      return false;
    }
    console.log('finished');
    battle.battleFinished = true;
    if (monsterAlive && !userAlive) {
      this.logger.log('User lost battle, skipping updates');
      battle.userLost = true;
      battle.notifyUsers();
      return true;
    }

    battle.generateBattleDrops();

    await this.updateStatsAndRewards(battle);
    battle.notifyUsers();
    return true;
  }

  private async updateStatsAndRewards(battle: BattleInstance) {
    this.logger.log('Battle finished, giving rewards');
    this.logger.log(JSON.stringify(battle.droppedItems));
    for await (const {
      userEmail,
      silver,
      dropedItems,
    } of battle.droppedItems) {
      const rewardUser = battle.getUserFromBattle(userEmail);
      const remainingHealth = rewardUser.stats.health;
      await this.userService.addSilverToUser({ userEmail, amount: silver });
      await this.userService.updateUserHealth({
        userEmail,
        amount: remainingHealth,
      });
      for await (const { itemId, stack } of dropedItems) {
        await this.itemService.addItemToUser({ userEmail, itemId, stack });
      }
      await this.userService.notifyUserUpdateWithProfile({ email: userEmail });
    }

    return true;
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
