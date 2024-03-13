import { Drop, Item, Monster, Stats, User } from '@prisma/client';
import { BattleUtils } from '../battleUtils';
import { WebsocketService } from 'src/websocket/websocket.service';
import { utils } from 'src/utils';

export type MonsterWithDrops = Monster & {
  drops: DropWithItem[];
};

export type DropWithItem = Drop & {
  item: Item;
};

export type UserWithStats = User & {
  stats: Stats;
};

export type Battle = {
  users: UserWithStats[];
  monsters: MonsterWithDrops[];
  attackerTurn: number;
  attackerList: string[];
  battleFinished: boolean;
  userLost: boolean;
  log: BattleLog[];
  drops: BattleDrop[];
};

type CreateBattleParams = {
  users: UserWithStats[];
  monsters: MonsterWithDrops[];
  socket: WebsocketService;
};

export type BattleLog = {
  icon?: string;
  message: string;
};

export type BattleDrop = {
  userEmail: string;
  silver: number;
  exp: number;
  dropedItems: BattleUserDropedItem[];
};

export type BattleUserDropedItem = {
  stack: number;
  itemId: number;
};

export class BattleInstance {
  private socket: WebsocketService;
  private users: UserWithStats[];
  private monsters: MonsterWithDrops[];
  private attackerTurn: number = 0;
  private attackerList: string[] = [];
  battleFinished: boolean = false;
  userLost: boolean = false;
  private log: BattleLog[] = [];
  private drops: BattleDrop[] = [];

  get droppedItems() {
    return this.drops;
  }

  get isMonsterAlive() {
    return this.monsters[0].health > 0;
  }
  get isPlayerAlive() {
    return this.users[0].stats.health > 0;
  }

  constructor({ monsters, users, socket }: CreateBattleParams) {
    this.socket = socket;
    this.users = users;
    this.monsters = monsters;
    this.attackerList = BattleUtils.generateBattleAttackOrder(users, monsters);
  }

  // Functions that round be called periodically
  tickBattle() {
    this.processMonsterAttack();
  }

  pushLog({ log, icon }: { log: string; icon?: string }) {
    this.log.push({ message: log, icon });
  }

  async processUserAttack(args: { email: string }) {
    const user = this.users.find((u) => u.email === args.email);
    const attackerList = this.attackerList;
    const attackerIndex = this.attackerTurn;
    const attacker = attackerList[attackerIndex];

    if (user && attacker === user.name) {
      const userDamage = user.stats.attack;
      const targetMonster = this.monsters[0];
      targetMonster.health -= userDamage;
      this.pushLog({
        log: `${user.name} Dealt ${userDamage} damage to ${targetMonster.name}`,
        icon: 'attack',
      });

      this.processNextTurn();
      this.notifyUsers();
      return true;
    }
    return false;
  }

  private async processMonsterAttack() {
    const attackerList = this.attackerList;
    const attackerIndex = this.attackerTurn;
    const attacker = attackerList[attackerIndex];

    const monster = this.monsters.find((m) => m.name === attacker);
    const isMonsterAlive = monster?.health > 0;

    if (monster && isMonsterAlive) {
      const monsterDamage = monster.attack;
      const targetUser = this.users[0];
      targetUser.stats.health -= monsterDamage;

      this.pushLog({
        log: `${monster.name} Dealt ${monsterDamage} damage to ${targetUser.name}`,
        icon: 'attack',
      });

      this.processNextTurn();
      this.notifyUsers();
      return true;
    }
    return false;
  }

  private async processNextTurn() {
    const pastAttacker = this.attackerTurn;
    const attackerList = this.attackerList;
    const maxIndex = attackerList.length - 1;

    if (pastAttacker < maxIndex) {
      return (this.attackerTurn = pastAttacker + 1);
    } else if (pastAttacker === maxIndex) {
      return (this.attackerTurn = 0);
    } else {
      return this.attackerTurn - 1;
    }
  }

  toJson() {
    return {
      users: this.users,
      monsters: this.monsters,
      attackerTurn: this.attackerTurn,
      attackerList: this.attackerList,
      battleFinished: this.battleFinished,
      userLost: this.userLost,
      log: this.log,
      drops: this.drops,
    };
  }

  notifyUsers() {
    this.users.forEach((user) => {
      const email = user.email;
      this.socket.sendMessageToSocket({
        email,
        payload: this.toJson(),
        event: 'battle_update',
      });
    });
  }

  notifyBattleRemoved() {
    this.users.forEach((user) => {
      const email = user.email;
      this.socket.sendMessageToSocket({
        email,
        payload: undefined,
        event: 'battle_update',
      });
    });
  }

  hasUser(email: string) {
    const user = this.users.find((u) => u.email === email);
    if (user) return true;
    return false;
  }

  getUserFromBattle(email: string) {
    return this.users.find((u) => u.email === email);
  }

  generateBattleDrops() {
    const targetMonster = this.monsters[0];
    this.users.forEach((user) => {
      const silverGain = targetMonster.silver;
      const expGain = targetMonster.exp;
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
        exp: expGain,
        dropedItems: dropedItems,
      };

      this.drops.push(battleDrop);
    });
  }
}
