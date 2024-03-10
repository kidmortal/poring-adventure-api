import { Injectable, Logger } from '@nestjs/common';

import { Battle, BattleDrop } from './entities/battle';
import { MonstersService } from 'src/monsters/monsters.service';
import { UsersService } from 'src/users/users.service';
import { utils } from 'src/utils';
import { ItemsService } from 'src/items/items.service';
import { Item } from '@prisma/client';
import { WebsocketService } from 'src/websocket/websocket.service';

@Injectable()
export class BattleService {
  constructor(
    private readonly monsterService: MonstersService,
    private readonly userService: UsersService,
    private readonly itemService: ItemsService,
    private readonly socket: WebsocketService,
  ) {}
  private battleList: Battle[] = [];
  private logger = new Logger('Battle');

  private notifyUsers(battle: Battle | false) {
    if (!battle) return;
    const email = battle.user.email;
    console.log(`notifying ${email}`);
    this.socket.sendMessageToSocket({
      email,
      payload: battle,
      event: 'battle_update',
    });
  }

  async getBattleFromUser(email: string) {
    const battle = await this.getUserBattle(email);
    if (battle) {
      this.notifyUsers(battle);
      return battle;
    }
    return false;
  }

  async create(userEmail: string) {
    const battle = this.getUserBattle(userEmail);
    if (!battle) {
      const userData = await this.userService.findOne(userEmail);
      const monsterData = await this.monsterService.findOne();
      const newBattleInstance: Battle = {
        user: userData,
        monster: monsterData,
        log: [],
        attackerTurn: '',
        battleFinished: false,
        userLost: false,
        drops: [],
      };
      this.notifyUsers(newBattleInstance);
      this.battleList.push(newBattleInstance);
      return true;
    }
    this.notifyUsers(battle);
    return true;
  }

  async remove(userEmail: string) {
    const battleIndex = this.battleList.findIndex(
      (battle) => battle.user.email === userEmail,
    );

    if (battleIndex >= 0) {
      this.battleList.splice(battleIndex, 1);
      this.socket.sendMessageToSocket({
        email: userEmail,
        payload: undefined,
        event: 'battle_update',
      });
      return true;
    }
    return false;
  }

  async attack(userEmail: string) {
    const battle = this.getUserBattle(userEmail);
    if (!battle) {
      return false;
    }
    if (battle.battleFinished) {
      return false;
    }
    const userDamage = battle.user.stats.attack;
    const monsterDamage = battle.monster.attack;

    battle.user.stats.health -= monsterDamage;
    battle.monster.health -= userDamage;
    battle.log.push(
      `${battle.user.name} Dealt ${userDamage} damage to ${battle.monster.name}`,
    );
    battle.log.push(
      `${battle.monster.name} Dealt ${monsterDamage} damage to ${battle.user.name}`,
    );
    return this.settleBattleAndProcessRewards(battle);
  }

  private async settleBattleAndProcessRewards(battle: Battle) {
    const monsterAlive = battle.monster.health > 0;
    const userAlive = battle.user.stats.health > 0;
    if (monsterAlive && userAlive) {
      this.notifyUsers(battle);
      return true;
    }
    console.log('finished');
    battle.battleFinished = true;
    if (monsterAlive && !userAlive) {
      this.logger.log('User lost battle, skipping updates');
      battle.userLost = true;
      this.notifyUsers(battle);
      return true;
    }
    const user = battle.user;
    const silverGain = battle.monster.silver;
    const drops = battle.monster.drops;
    const dropedItems: { itemId: number; stack: number; item: Item }[] = [];

    drops.forEach(({ chance, item, itemId, minAmount, maxAmount }) => {
      if (utils.isSuccess(chance)) {
        const amount = utils.getRandomNumberBetween(minAmount, maxAmount);
        dropedItems.push({
          itemId: itemId,
          stack: amount,
          item: item,
        });
      }
    });

    const battleDrop: BattleDrop = {
      userEmail: user.email,
      silver: silverGain,
      dropedItems: dropedItems,
    };
    battle.drops = [battleDrop];
    await this.updateStatsAndRewards(battle);
    this.notifyUsers(battle);
    return true;
  }

  private async updateStatsAndRewards(battle: Battle) {
    this.logger.log('Battle finished, giving rewards');
    this.logger.log(JSON.stringify(battle.drops));
    for await (const { userEmail, silver, dropedItems } of battle.drops) {
      const remainingHealth = battle.user.stats.health;
      await this.userService.addSilverToUser({ userEmail, amount: silver });
      await this.userService.updateUserHealth({
        userEmail,
        amount: remainingHealth,
      });
      for await (const { itemId, stack } of dropedItems) {
        await this.itemService.addItemToUser({ userEmail, itemId, stack });
      }
    }
    return true;
  }

  private getUserBattle(userEmail: string) {
    const onGoingBattle = this.battleList.find(
      (battle) => battle.user.email === userEmail,
    );
    if (onGoingBattle) {
      return onGoingBattle;
    }
    return false;
  }
}
