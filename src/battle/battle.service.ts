import { Injectable, Logger } from '@nestjs/common';

import { Battle, BattleDrop, UserWithStats } from './entities/battle';
import { MonstersService } from 'src/monsters/monsters.service';
import { UsersService } from 'src/users/users.service';
import { utils } from 'src/utils';
import { ItemsService } from 'src/items/items.service';
import { Item } from '@prisma/client';
import { WebsocketService } from 'src/websocket/websocket.service';
import { BattleUtils } from './battleUtils';
import { Cron } from '@nestjs/schedule';

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

  @Cron('* * * * * *')
  private runEverySecond() {
    this.battleList.forEach((b) => this.tickBattle(b));
  }

  private tickBattle(battle: Battle) {
    this.processMonsterAttack({ battle });
  }

  private notifyBattleRemoved(battle: Battle | false) {
    if (!battle) return;

    battle.users.forEach((user) => {
      const email = user.email;
      this.socket.sendMessageToSocket({
        email,
        payload: undefined,
        event: 'battle_update',
      });
    });
  }

  private notifyUsers(battle: Battle | false) {
    if (!battle) return;
    battle.users.forEach((user) => {
      const email = user.email;
      this.socket.sendMessageToSocket({
        email,
        payload: battle,
        event: 'battle_update',
      });
    });
  }

  async getBattleFromUser(email: string) {
    const battle = this.getUserBattle(email);
    if (battle) {
      this.logger.debug(`Notifying party about updates`);
      this.notifyUsers(battle);
      return battle;
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
      const attackerList = BattleUtils.generateBattleAttackOrder(
        users,
        monsters,
      );
      const newBattleInstance: Battle = {
        users: users,
        monsters: monsters,
        log: [],
        attackerTurn: 0,
        attackerList: attackerList,
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
    const battleIndex = this.battleList.findIndex((battle) =>
      battle.users.find((u) => u.email === userEmail),
    );

    if (battleIndex >= 0) {
      const removedBattle = this.battleList.splice(battleIndex, 1);
      if (removedBattle[0]) {
        this.notifyBattleRemoved(removedBattle[0]);
      }

      return true;
    }
    return false;
  }

  async attack(userEmail: string) {
    const battle = this.getUserBattle(userEmail);
    if (!battle) return false;
    if (battle.battleFinished) return false;
    const didAttack = await this.processUserAttack({
      battle,
      email: userEmail,
    });
    if (didAttack) {
      const didBattleFinish = await this.settleBattleAndProcessRewards(battle);
      if (didBattleFinish) return true;
    }

    return false;
  }

  private async settleBattleAndProcessRewards(battle: Battle) {
    const monsterAlive = battle.monsters[0].health > 0;
    const userAlive = battle.users[0].stats.health > 0;
    if (monsterAlive && userAlive) {
      this.notifyUsers(battle);
      return false;
    }
    console.log('finished');
    battle.battleFinished = true;
    if (monsterAlive && !userAlive) {
      this.logger.log('User lost battle, skipping updates');
      battle.userLost = true;
      this.notifyUsers(battle);
      return true;
    }

    const targetMonster = battle.monsters[0];
    battle.users.forEach((user) => {
      const silverGain = targetMonster.silver;
      const drops = targetMonster.drops;
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

      battle.drops.push(battleDrop);
    });

    await this.updateStatsAndRewards(battle);
    this.notifyUsers(battle);
    return true;
  }

  private async updateStatsAndRewards(battle: Battle) {
    this.logger.log('Battle finished, giving rewards');
    this.logger.log(JSON.stringify(battle.drops));
    for await (const { userEmail, silver, dropedItems } of battle.drops) {
      const rewardUser = battle.users.find((u) => u.email === userEmail);
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

  private async processUserAttack(args: { battle: Battle; email: string }) {
    const user = args.battle.users.find((u) => u.email === args.email);
    const attackerList = args.battle.attackerList;
    const attackerIndex = args.battle.attackerTurn;
    const attacker = attackerList[attackerIndex];

    if (user && attacker === user.name) {
      const userDamage = user.stats.attack;
      const targetMonster = args.battle.monsters[0];
      targetMonster.health -= userDamage;
      args.battle.log.push(
        `${user.name} Dealt ${userDamage} damage to ${targetMonster.name}`,
      );
      this.processNextTurn({ battle: args.battle });
      this.notifyUsers(args.battle);
      return true;
    }
    this.logger.debug(`Not your turn ${args.email}`);
    return false;
  }

  private async processMonsterAttack(args: { battle: Battle }) {
    const attackerList = args.battle.attackerList;
    const attackerIndex = args.battle.attackerTurn;
    const attacker = attackerList[attackerIndex];

    const monster = args.battle.monsters.find((m) => m.name === attacker);

    if (monster) {
      const monsterDamage = monster.attack;
      const targetUser = args.battle.users[0];
      targetUser.stats.health -= monsterDamage;

      args.battle.log.push(
        `${monster.name} Dealt ${monsterDamage} damage to ${targetUser.name}`,
      );
      this.processNextTurn({ battle: args.battle });
      this.notifyUsers(args.battle);
      return true;
    }
    return false;
  }

  private async processNextTurn(args: { battle: Battle }) {
    const pastAttacker = args.battle.attackerTurn;
    const attackerList = args.battle.attackerList;
    const maxIndex = attackerList.length - 1;

    console.log({
      pastAttacker,
      length: attackerList.length,
    });
    if (pastAttacker < maxIndex) {
      return (args.battle.attackerTurn = pastAttacker + 1);
    } else if (pastAttacker === maxIndex) {
      return (args.battle.attackerTurn = 0);
    } else {
      return args.battle.attackerTurn - 1;
    }
  }

  private getUserBattle(userEmail: string) {
    let userBattle = undefined;
    if (!userEmail) return userBattle;
    this.battleList.forEach((onGoingBattle) => {
      const hasUser = onGoingBattle.users.find(
        (user) => user.email === userEmail,
      );
      if (hasUser) {
        userBattle = onGoingBattle;
      }
    });

    return userBattle;
  }
}
