import {
  Buff,
  Drop,
  Item,
  LearnedSkill,
  Monster,
  Skill,
  Stats,
  User,
  UserBuff,
} from '@prisma/client';
import { BattleUtils } from './battleUtils';
import { WebsocketService } from 'src/websocket/websocket.service';
import { utils } from 'src/utils';
import { runEffect } from './effects';

enum SkillCategory {
  TargetEnemy = 'target_enemy',
  TargetAlly = 'target_ally',
}

enum SkillEffect {
  Healing = 'healing',
  Infusion = 'infusion',
}

type DamageInfo = {
  image: string;
  name: string;
  skill?: LearnedSkillWithSkill;
  value: number;
};

export type DamageStepParams = {
  attacker: 'user' | 'monster';
  user: UserWithStats;
  monster: MonsterWithDrops;
  damage: DamageInfo;
  skipDamageStep?: boolean;
};

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
  buffs: UserBuffWithBuff[];
};
type UserBuffWithBuff = UserBuff & {
  buff: Buff;
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

      return this.beforeDamageStep({
        attacker: 'user',
        monster: targetMonster,
        user: user,
        damage: {
          image: 'https://kidmortal.sirv.com/skills/attack.webp',
          name: '',
          value: userDamage,
        },
      });
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
    const targetMonster = this.monsters[0];
    const userDamage = args.user.stats.attack + userAttribute * multiplier;

    return this.beforeDamageStep({
      attacker: 'user',
      monster: targetMonster,
      user: args.user,
      damage: {
        image: args.skill.skill.image,
        name: '',
        value: userDamage,
        skill: args.skill,
      },
    });
  }

  private async processCastTargetAlly(args: {
    user: UserWithStats;
    skill: LearnedSkillWithSkill;
  }) {
    const userAttribute: number = args.user.stats[args.skill.skill.attribute];
    const multiplier = args.skill.skill.multiplier * args.skill.masteryLevel;
    const potency = utils.randomDamage(userAttribute * multiplier, 20);
    args.user.stats.mana -= args.skill.skill.manaCost;
    if (args.skill.skill.effect === SkillEffect.Healing) {
      const targetAlly = this.getLowestHealthMember();
      this.healUser({ user: targetAlly, amount: potency });
      this.pushLog({
        log: `${args.user.name} Healed ${targetAlly.name} by ${potency} Health Points`,
        icon: args.skill.skill.image,
      });
    }

    if (args.skill.skill.effect === SkillEffect.Infusion) {
      const targetAlly = this.getLowestManaMember();
      this.infuseUser({ user: targetAlly, amount: potency });
      this.pushLog({
        log: `${args.user.name} Infused ${targetAlly.name} by ${potency} Mana Points`,
        icon: args.skill.skill.image,
      });
    }

    this.processNextTurn();
    this.notifyUsers();
    return true;
  }

  private getLowestManaMember() {
    let lowestUser = this.users[0];
    this.users.forEach((user) => {
      const currentLowestPercentage = Math.floor(
        (lowestUser.stats.mana / lowestUser.stats.maxMana) * 100,
      );
      const currentPercentage = Math.floor(
        (user.stats.mana / user.stats.maxMana) * 100,
      );
      if (currentPercentage < currentLowestPercentage) {
        lowestUser = user;
      }
    });
    return lowestUser;
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
  private async infuseUser(args: { user: UserWithStats; amount: number }) {
    args.user.stats.mana += args.amount;
    if (args.user.stats.mana > args.user.stats.maxMana) {
      args.user.stats.mana = args.user.stats.maxMana;
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
      return this.beforeDamageStep({
        attacker: 'monster',
        monster: monster,
        user: targetUser,
        damage: {
          image: 'https://kidmortal.sirv.com/skills/attack.webp',
          name: '',
          value: monsterDamage,
        },
      });
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

  private beforeDamageStep(args: DamageStepParams) {
    if (args.attacker === 'monster') {
      if (args.user.buffs.length > 0) {
        args.user.buffs.forEach(({ buff }) => {
          runEffect({
            effect: buff.effect,
            dmgStep: args,
            role: 'defender',
            image: buff.image,
            battle: this,
          });
        });
      }
    }
    if (args.attacker === 'user') {
      if (args.damage.skill) {
        const userSkill = args.damage.skill;
        args.user.stats.mana -= userSkill.skill.manaCost;
      }
    }
    if (!args.skipDamageStep) {
      console.log('run dmg');
      return this.startDamageStep(args);
    } else {
      console.log('skip dmg');
      return this.afterDamageStep();
    }
  }

  private startDamageStep({
    attacker,
    damage,
    user,
    monster,
  }: DamageStepParams) {
    const randomDmg = utils.randomDamage(damage.value, 20);
    if (attacker === 'user') {
      monster.health -= randomDmg;
      this.pushLog({
        log: `${user.name} Dealt ${randomDmg} damage to ${monster.name}`,
        icon: damage.image,
      });
    }
    if (attacker === 'monster') {
      this.damageUser({ user: user, amount: randomDmg });
      this.pushLog({
        log: `${monster.name} Dealt ${randomDmg} damage to ${user.name}`,
        icon: damage.image,
      });
    }
    this.afterDamageStep();
  }

  private afterDamageStep() {
    this.processNextTurn();
    this.notifyUsers();
    return true;
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
