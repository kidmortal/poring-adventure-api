import {
  Drop,
  Item,
  LearnedSkill,
  Monster,
  Skill,
  Stats,
  User,
} from '@prisma/client';
import { BattleUtils } from '../battleUtils';
import { WebsocketService } from 'src/websocket/websocket.service';
import { utils } from 'src/utils';

enum SkillCategory {
  TargetEnemy = 'target_enemy',
  TargetAlly = 'target_ally',
}

export type MonsterWithDrops = Monster & {
  drops: DropWithItem[];
};

export type DropWithItem = Drop & {
  item: Item;
};

export type UserWithStats = User & {
  stats: Stats;
  isDead?: boolean;
  learnedSkills: LearnedSkillWithSkill[];
};

type LearnedSkillWithSkill = LearnedSkill & {
  skill: Skill;
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
  get isPlayersAlive() {
    const aliveUsers = this.users.filter((u) => !u.isDead);
    if (aliveUsers.length > 0) {
      return true;
    } else {
      return false;
    }
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
    const isUserTurn = this.isUserTurn(args);

    if (isUserTurn) {
      const user = this.getUserFromBattle(args.email);
      const userDamage = user.stats.attack;
      const targetMonster = this.monsters[0];
      targetMonster.health -= userDamage;
      this.pushLog({
        log: `${user.name} Dealt ${userDamage} damage to ${targetMonster.name}`,
        icon: 'https://kidmortal.sirv.com/skills/attack.webp',
      });

      this.processNextTurn();
      this.notifyUsers();
      return true;
    }
    return false;
  }

  async processUserCast(args: { email: string; skillId: number }) {
    const isUserTurn = this.isUserTurn(args);
    if (isUserTurn) {
      const user = this.getUserFromBattle(args.email);
      const skill = this.getSkillFromUser(args);
      switch (skill.skill.category) {
        case SkillCategory.TargetEnemy:
          return this.processCastTargetEnemy({ user, skill });
        case SkillCategory.TargetAlly:
          return this.processCastTargetAlly({ user, skill });

        default:
          return this.processCastTargetEnemy({ user, skill });
      }
    }
    return false;
  }

  private async processCastTargetEnemy(args: {
    user: UserWithStats;
    skill: LearnedSkillWithSkill;
  }) {
    const userAttribute: number = args.user.stats[args.skill.skill.attribute];
    const multiplier = args.skill.skill.multiplier * args.skill.masteryLevel;
    const userDamage = args.user.stats.attack + userAttribute * multiplier;
    const targetMonster = this.monsters[0];
    args.user.stats.mana -= args.skill.skill.manaCost;
    targetMonster.health -= userDamage;
    this.pushLog({
      log: `${args.user.name} Dealt ${userDamage} damage to ${targetMonster.name}`,
      icon: args.skill.skill.image,
    });
    this.processNextTurn();
    this.notifyUsers();
    return true;
  }

  private async processCastTargetAlly(args: {
    user: UserWithStats;
    skill: LearnedSkillWithSkill;
  }) {
    const userAttribute: number = args.user.stats[args.skill.skill.attribute];
    const multiplier = args.skill.skill.multiplier * args.skill.masteryLevel;
    const userHealing = userAttribute * multiplier;
    const targetAlly = this.getLowestHealthMember();
    args.user.stats.mana -= args.skill.skill.manaCost;
    this.healUser({ user: targetAlly, amount: userHealing });
    this.pushLog({
      log: `${args.user.name} Healed ${targetAlly.name} by ${userHealing} Points`,
      icon: args.skill.skill.image,
    });
    this.processNextTurn();
    this.notifyUsers();
    return true;
  }

  private getLowestHealthMember() {
    let lowestUser = this.users[0];
    this.users.forEach((user) => {
      const currentLowestPercentage = Math.floor(
        (lowestUser.stats.health / lowestUser.stats.maxHealth) * 100,
      );
      const currentPercentage = Math.floor(
        (user.stats.health / user.stats.maxHealth) * 100,
      );
      if (currentPercentage < currentLowestPercentage) {
        lowestUser = user;
      }
    });
    return lowestUser;
  }

  private async healUser(args: { user: UserWithStats; amount: number }) {
    args.user.stats.health += args.amount;
    if (args.user.stats.health > args.user.stats.maxHealth) {
      args.user.stats.health = args.user.stats.maxHealth;
    }
  }
  private async damageUser(args: { user: UserWithStats; amount: number }) {
    args.user.stats.health -= args.amount;
    if (args.user.stats.health <= 0) {
      args.user.stats.health = 0;
      args.user.isDead = true;
    }
  }

  private async processMonsterAttack() {
    const attackerList = this.attackerList;
    const attackerIndex = this.attackerTurn;
    const attacker = attackerList[attackerIndex];

    const monster = this.monsters.find((m) => m.name === attacker);
    const isMonsterAlive = monster?.health > 0;

    if (monster && isMonsterAlive) {
      const monsterDamage = monster.attack;
      const random = Math.floor(Math.random() * this.users.length);
      const targetUser = this.users[random];
      this.damageUser({ user: targetUser, amount: monsterDamage });

      this.pushLog({
        log: `${monster.name} Dealt ${monsterDamage} damage to ${targetUser.name}`,
        icon: 'https://kidmortal.sirv.com/skills/attack.webp',
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

  private isUserTurn(args: { email: string }) {
    const user = this.getUserFromBattle(args.email);
    const attackerList = this.attackerList;
    const attackerIndex = this.attackerTurn;
    const attacker = attackerList[attackerIndex];

    return user && attacker === user.name;
  }

  private getSkillFromUser(args: { email: string; skillId: number }) {
    const user = this.getUserFromBattle(args.email);
    const castingSkill = user.learnedSkills.find(
      (skill) => skill.skillId === args.skillId,
    );
    if (castingSkill) {
      return castingSkill;
    }
    return undefined;
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
