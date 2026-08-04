import { Buff, Debuff, Drop, Item, LearnedSkill, Monster, Skill, Stats, User, UserBuff } from '@prisma/client';
import { BattleUtils } from './battleUtils';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { Utils } from 'src/utilities/utils';
import { runEffect } from './effects';
import {
  applyDebuff,
  BattleDebuff,
  DebuffEffect,
  debuffedAttack,
  debuffedDefense,
  isStunned,
  poisonDamage,
  tickDebuffs,
} from './debuffs';

enum SkillCategory {
  TargetEnemy = 'target_enemy',
  TargetAlly = 'target_ally',
  BuffSelf = 'buff_self',
  /**
   * Restores the caster and nobody else. This is what keeps a Mage's own pool
   * topped up without making them a healer: only a Priest may point health or
   * mana at somebody other than themselves.
   */
  SelfRestore = 'self_restore',
}

enum SkillEffect {
  Healing = 'healing',
  Infusion = 'infusion',
}

/** Buff effects the engine acts on directly rather than through `runEffect`. */
enum BuffEffect {
  SecondWind = 'second_wind',
}

/** How much health a Revive Draught leaves you standing on. */
const SECOND_WIND_HEALTH = 0.3;

/** Each enraged swing is this much harder than the one before it. */
const ENRAGE_DAMAGE_MULTIPLIER = 1.3;

/**
 * What each target of an area skill is worth against a single-target cast of the
 * same power. Below one, so clearing a pack is what an area skill is for and
 * a lone monster is still the single-target skill's job.
 */
const AREA_POWER_MULTIPLIER = 0.7;

type DamageInfo = {
  image: string;
  name: string;
  skill?: LearnedSkillWithSkill;
  value: number;
  aggro: number;
};

export type DamageStepParams = {
  attacker: 'user' | 'monster';
  user: UserWithStats;
  monster: MonsterInBattle;
  damage: DamageInfo;
  skipDamageStep?: boolean;
  /**
   * Set while an area skill is still working through its targets: the hit lands,
   * but the turn does not end until the last one has.
   */
  deferTurnEnd?: boolean;
};

export type MonsterWithDrops = Monster & {
  drops: DropWithItem[];
};

/**
 * A monster at the table. `maxHealth` is what it stood up with — the client
 * draws the bar against it, and poison burns a share of it — and `debuffs` is
 * everything the party has stuck on it, shipped in the battle payload so the
 * icons can be drawn beside that bar. Neither is ever written back to the row.
 */
export type MonsterInBattle = MonsterWithDrops & {
  maxHealth: number;
  debuffs: BattleDebuff[];
};

export type DropWithItem = Drop & {
  item: Item;
};

export type UserWithStats = User & {
  stats: Stats;
  isDead?: boolean;
  aggro?: number;
  learnedSkills: LearnedSkillWithSkill[];
  buffs: UserBuffWithBuff[];
};
type UserBuffWithBuff = UserBuff & {
  buff: Buff;
};

type LearnedSkillWithSkill = LearnedSkill & {
  skill: SkillWithBuff;
  cooldown?: number;
};
type SkillWithBuff = Skill & {
  buff?: Buff;
  debuff?: Debuff;
};

export type Battle = {
  users: UserWithStats[];
  monsters: MonsterInBattle[];
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
  updateUsers: (battle: BattleInstance) => Promise<void>;
  removeBattle: () => Promise<boolean>;
  /** Set when the monster is a guild's standing boss, whose health pool is persisted. */
  guildBossGuildId?: number;
  /** Round after which the monster starts enraging. Left unset, it never does. */
  enrageAfterRound?: number;
  /** Who led the party in, when it was not a solo fight. */
  partyLeaderEmail?: string;
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
  private monsters: MonsterInBattle[];
  private attackerTurn: number = 0;
  private attackerList: string[] = [];
  battleFinished: boolean = false;
  userLost: boolean = false;
  updateUsers: (battle: BattleInstance) => Promise<void>;
  removeBattle: () => Promise<boolean>;
  private log: BattleLog[] = [];
  private drops: BattleDrop[] = [];
  /** Damage each player has landed on the monsters, by email. Never decays. */
  private damageDealt: { [email: string]: number } = {};
  readonly guildBossGuildId?: number;
  readonly partyLeaderEmail?: string;
  private readonly enrageAfterRound?: number;
  /** Passes through the attack order, counted from 1. */
  private round = 1;
  /** How many times the monster has swung while enraged. */
  private enrageStacks = 0;

  get droppedItems() {
    return this.drops;
  }

  /**
   * Hands over the damage landed so far and forgets it, so a fight that is
   * settled twice — won, then reset — cannot bank the same hits again.
   */
  consumeDamage() {
    const dealt = Object.entries(this.damageDealt).map(([userEmail, damage]) => ({ userEmail, damage }));
    this.damageDealt = {};
    return dealt;
  }

  /** Everyone who walked in, whether or not they landed a hit. */
  get participantEmails() {
    return this.users.map((user) => user.email);
  }

  /** A pull is over when the last monster in it falls, not the first. */
  get isMonsterAlive() {
    return this.monsters.some((monster) => monster.health > 0);
  }

  /** Everything still standing, in turn order — what an area skill hits. */
  get aliveMonsters() {
    return this.monsters.filter((monster) => monster.health > 0);
  }
  get isPlayersAlive() {
    const aliveUsers = this.users.filter((u) => !u.isDead);
    if (aliveUsers.length > 0) {
      return true;
    } else {
      return false;
    }
  }

  get monsterCount() {
    return this.monsters.length;
  }

  get monstersMapId() {
    return this.monsters[0].mapId;
  }

  /** A fight with a single player has nobody else to strand by leaving. */
  get isSolo() {
    return this.users.length <= 1;
  }

  /** Whose turn it currently is, by name. */
  get currentTurnName() {
    return this.attackerList[this.attackerTurn];
  }

  constructor({
    monsters,
    users,
    socket,
    updateUsers,
    removeBattle,
    guildBossGuildId,
    enrageAfterRound,
    partyLeaderEmail,
  }: CreateBattleParams) {
    this.socket = socket;
    this.users = this.generateUserBattleValues(users);
    this.monsters = this.generateMonsterBattleValues(monsters);
    this.attackerList = BattleUtils.generateBattleAttackOrder(users, this.monsters);
    this.updateUsers = updateUsers;
    this.removeBattle = removeBattle;
    this.guildBossGuildId = guildBossGuildId;
    this.enrageAfterRound = enrageAfterRound;
    this.partyLeaderEmail = partyLeaderEmail;
  }

  /** True once the fight has run past the round the monster starts enraging on. */
  private get isEnraged() {
    return !!this.enrageAfterRound && this.round > this.enrageAfterRound;
  }

  // Functions that round be called periodically
  tickBattle() {
    // A settled fight — won or wiped — waits to be dismissed rather than
    // carrying on swinging at a party that cannot answer.
    if (this.battleFinished) return;
    this.processMonsterAttack();
  }

  pushLog({ log, icon }: { log: string; icon?: string }) {
    this.log.push({ message: log, icon });
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
      round: this.round,
      enrageStacks: this.enrageStacks,
      // The client sends the player back to the guild rather than the map
      // selection when this fight ends.
      guildBoss: !!this.guildBossGuildId,
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
    this._notifyDiscord();
  }

  private _notifyDiscord() {
    this.socket.sendMessageToSocket({
      email: 'discord',
      payload: this.toJson(),
      event: 'battle_update',
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
    this.users.forEach((user) => {
      const dropedItems: {
        [itemId: string]: { itemId: number; stack: number; item: Item };
      } = {};
      let silverGain = 0;
      let expGain = 0;

      this.monsters.forEach((monster) => {
        silverGain += monster.silver;
        expGain += monster.exp;
        monster.drops.forEach(({ chance, item, itemId, minAmount, maxAmount }) => {
          if (Utils.isSuccess(chance)) {
            const amount = Utils.getRandomNumberBetween(minAmount, maxAmount);
            if (dropedItems[itemId]) {
              dropedItems[itemId].stack += amount;
            } else {
              dropedItems[itemId] = {
                itemId: itemId,
                stack: amount,
                item: item,
              };
            }
          }
        });
      });

      const battleDrop: BattleDrop = {
        userEmail: user.email,
        silver: silverGain,
        exp: expGain,
        dropedItems: Object.values(dropedItems),
      };

      this.drops.push(battleDrop);
    });
  }

  async processUserAttack(args: { email: string }) {
    const isUserTurn = this.isUserTurn(args);

    if (isUserTurn) {
      const user = this.getUserFromBattle(args.email);
      const userDamage = user.stats.attack;
      const targetMonster = this.defaultMonsterTarget();
      if (!targetMonster) return false;

      return this.beforeDamageStep({
        attacker: 'user',
        monster: targetMonster,
        user: user,
        damage: {
          image: 'https://kidmortal.sirv.com/skills/attack.webp',
          name: '',
          value: userDamage,
          aggro: userDamage,
        },
      });
    }
    return false;
  }

  async processUserCast(args: { email: string; skillId: number; targetName: string }) {
    const isUserTurn = this.isUserTurn(args);
    if (isUserTurn) {
      const user = this.getUserFromBattle(args.email);
      const skill = this.getSkillFromUser(args);
      if (!skill) return false;
      if (skill.cooldown > 0) return false;
      // A healer who cannot budget their mana is not playing a resource role.
      // The cast is refused outright rather than driving the pool negative.
      if (user.stats.mana < skill.skill.manaCost) {
        this.pushLog({
          icon: skill.skill.image,
          log: `${user.name} does not have the mana for ${skill.skill.name}`,
        });
        this.notifyUsers();
        return false;
      }
      skill.cooldown += skill.skill.cooldown;
      switch (skill.skill.category) {
        case SkillCategory.TargetEnemy:
          return this.processCastTargetEnemy({
            user,
            skill,
            targetName: args.targetName,
          });
        case SkillCategory.TargetAlly:
          return this.processCastTargetAlly({
            user,
            skill,
            targetName: args.targetName,
          });
        case SkillCategory.BuffSelf:
          return this.processCastBuffSelf({ user, skill });
        case SkillCategory.SelfRestore:
          return this.processCastSelfRestore({ user, skill });

        default:
          return this.processCastTargetEnemy({ user, skill });
      }
    }
    return false;
  }

  /**
   * Drinking something mid-fight. It costs the turn, which is the entire trade
   * against a Priest: a party without one can substitute silver for a heal, and
   * pay for it in tempo rather than in a party slot.
   *
   * The stack is already gone from the inventory by the time this runs — the
   * caller owns the database, this owns what happens at the table.
   */
  async processUserConsume(args: {
    email: string;
    itemName: string;
    image: string;
    health: number;
    mana: number;
    buff?: Buff;
    buffDuration?: number;
  }) {
    if (!this.isUserTurn(args)) return false;
    const user = this.getUserFromBattle(args.email);
    if (!user) return false;

    const restored: string[] = [];
    if (args.health) {
      this.healUser({ user, amount: args.health });
      restored.push(`${args.health} health`);
    }
    if (args.mana) {
      this.infuseUser({ user, amount: args.mana });
      restored.push(`${args.mana} mana`);
    }
    if (args.buff) {
      // Pushed as its own copy, because decreaseOrRemoveBuffs ticks the buff
      // object down and a shared row would drain every drinker at once.
      user.buffs.push({
        id: 0,
        userEmail: user.email,
        buffId: args.buff.id,
        duration: args.buffDuration ?? args.buff.duration,
        buff: { ...args.buff, duration: args.buffDuration ?? args.buff.duration },
      });
      restored.push(args.buff.name);
    }

    this.pushLog({
      icon: args.image,
      log: `${user.name} used ${args.itemName}${restored.length ? ` — ${restored.join(', ')}` : ''}`,
    });
    return this.afterDamageStep();
  }

  /** Whether it is this player's move, for callers that must check before writing. */
  isTurnOf(email: string) {
    return this.isUserTurn({ email });
  }

  private async processCastTargetEnemy(args: {
    user: UserWithStats;
    skill: LearnedSkillWithSkill;
    targetName?: string;
  }) {
    const userAttribute: number = args.user.stats[args.skill.skill.attribute];
    const multiplier = args.skill.skill.multiplier * args.skill.masteryLevel;
    const targets = args.skill.skill.areaOfEffect
      ? this.aliveMonsters
      : [args.targetName ? this.getMonsterTarget(args.targetName) : this.defaultMonsterTarget()].filter(Boolean);

    // Nothing left to point it at. The cast is refunded rather than eaten,
    // since the fight is already over by the time this can happen.
    if (targets.length === 0) return false;

    const areaCast = args.skill.skill.areaOfEffect && targets.length > 1;
    const userDamage = Math.floor(
      (args.user.stats.attack + userAttribute * multiplier) * (areaCast ? AREA_POWER_MULTIPLIER : 1),
    );

    if (areaCast) {
      this.pushLog({
        icon: args.skill.skill.image,
        log: `${args.user.name} cast ${args.skill.skill.name} on ${targets.length} enemies`,
      });
    }

    // An area skill is one cast: the mana is spent once, and the turn ends once,
    // after the last target has been resolved. `damage.skill` is what charges
    // mana inside the damage step, so it is left off the per-target hits.
    if (areaCast) args.user.stats.mana -= args.skill.skill.manaCost;

    targets.forEach((monster, index) => {
      this.applySkillDebuff({ user: args.user, skill: args.skill, monster });
      this.beforeDamageStep({
        attacker: 'user',
        monster,
        user: args.user,
        damage: {
          image: args.skill.skill.image,
          name: '',
          value: userDamage,
          skill: areaCast ? undefined : args.skill,
          // Threat is no longer the same thing as damage: a skill decides how
          // loudly it lands, which is the only reason a tank can hold a boss it
          // is not out-damaging anyone with.
          aggro: Math.floor(userDamage * (args.skill.skill.threatModifier ?? 1)),
        },
        deferTurnEnd: index < targets.length - 1,
      });
    });
    return true;
  }

  /** Sticks whatever the skill carries onto the monster it just landed on. */
  private applySkillDebuff(args: { user: UserWithStats; skill: LearnedSkillWithSkill; monster: MonsterInBattle }) {
    const debuff = args.skill.skill.debuff;
    if (!debuff) return;

    if (applyDebuff({ monster: args.monster, debuff })) {
      this.pushLog({
        icon: debuff.image,
        log: `${args.monster.name} is afflicted with ${debuff.name} by ${args.user.name}`,
      });
    }
  }

  private async processCastTargetAlly(args: {
    user: UserWithStats;
    skill: LearnedSkillWithSkill;
    targetName?: string;
  }) {
    const userAttribute: number = args.user.stats[args.skill.skill.attribute];
    const multiplier = args.skill.skill.multiplier * args.skill.masteryLevel;
    const areaCast = args.skill.skill.areaOfEffect;
    // The party heal is the mirror of the party nuke: it reaches everyone, and
    // pays the same rate per head for doing it.
    const rawPotency = userAttribute * multiplier * (areaCast ? AREA_POWER_MULTIPLIER : 1);
    args.user.stats.mana -= args.skill.skill.manaCost;

    if (args.skill.skill.effect === SkillEffect.Healing) {
      // The dead are past healing — a Priest's turn spent topping up a corpse is
      // the turn the party needed to stay alive.
      const targets = areaCast
        ? this.users.filter((user) => !user.isDead)
        : [args.targetName ? this.getUserTarget(args.targetName) : this.getLowestHealthMember()];

      targets.forEach((targetAlly) => {
        const potency = Utils.randomDamage(rawPotency, 20);
        this.healUser({ user: targetAlly, amount: potency });
        this.pushLog({
          log: `${args.user.name} Healed ${targetAlly.name} by ${potency} Health Points`,
          icon: args.skill.skill.image,
        });
      });
    }

    if (args.skill.skill.effect === SkillEffect.Infusion) {
      const targets = areaCast
        ? this.users.filter((user) => !user.isDead)
        : [args.targetName ? this.getUserTarget(args.targetName) : this.getLowestManaMember()];

      targets.forEach((targetAlly) => {
        const potency = Utils.randomDamage(rawPotency, 20);
        this.infuseUser({ user: targetAlly, amount: potency });
        this.pushLog({
          log: `${args.user.name} Infused ${targetAlly.name} by ${potency} Mana Points`,
          icon: args.skill.skill.image,
        });
      });
    }
    return this.afterDamageStep();
  }

  /**
   * The caster's own second wind: the same healing and infusion effects, with
   * the target fixed to whoever cast it. A class that can put health or mana on
   * an ally is a support class, and that slot belongs to the Priest — so this is
   * the only restoring a Mage is allowed to do, and the target is not a choice.
   */
  private async processCastSelfRestore(args: { user: UserWithStats; skill: LearnedSkillWithSkill }) {
    const userAttribute: number = args.user.stats[args.skill.skill.attribute];
    const multiplier = args.skill.skill.multiplier * args.skill.masteryLevel;
    const potency = Utils.randomDamage(userAttribute * multiplier, 20);
    args.user.stats.mana -= args.skill.skill.manaCost;

    if (args.skill.skill.effect === SkillEffect.Healing) {
      this.healUser({ user: args.user, amount: potency });
      this.pushLog({
        log: `${args.user.name} Recovered ${potency} Health Points`,
        icon: args.skill.skill.image,
      });
    }

    if (args.skill.skill.effect === SkillEffect.Infusion) {
      this.infuseUser({ user: args.user, amount: potency });
      this.pushLog({
        log: `${args.user.name} Recovered ${potency} Mana Points`,
        icon: args.skill.skill.image,
      });
    }
    return this.afterDamageStep();
  }

  private async processCastBuffSelf(args: { user: UserWithStats; skill: LearnedSkillWithSkill }) {
    args.user.stats.mana -= args.skill.skill.manaCost;
    if (args.skill.skill.buff) {
      const buff = args.skill.skill.buff;
      args.user.buffs.push({
        duration: buff.duration,
        id: 0,
        userEmail: args.user.email,
        buffId: buff.id,
        // A copy, so nothing at the table can write back into the shared row
        // hanging off the skill definition.
        buff: { ...buff },
      });
      this.pushLog({
        log: `${args.user.name} Casted ${buff.name} on himself`,
        icon: args.skill.skill.image,
      });
    }
    return this.afterDamageStep();
  }

  private getLowestManaMember() {
    let lowestUser = this.users[0];
    this.users.forEach((user) => {
      const currentLowestPercentage = Math.floor((lowestUser.stats.mana / lowestUser.stats.maxMana) * 100);
      const currentPercentage = Math.floor((user.stats.mana / user.stats.maxMana) * 100);
      if (currentPercentage < currentLowestPercentage) {
        lowestUser = user;
      }
    });
    return lowestUser;
  }

  private getLowestHealthMember() {
    let lowestUser = this.users[0];
    this.users.forEach((user) => {
      const currentLowestPercentage = Math.floor((lowestUser.stats.health / lowestUser.stats.maxHealth) * 100);
      const currentPercentage = Math.floor((user.stats.health / user.stats.maxHealth) * 100);
      if (currentPercentage < currentLowestPercentage) {
        lowestUser = user;
      }
    });
    return lowestUser;
  }

  /** The monster only looks at people who can still be killed. */
  private getHighestAggroPlayer() {
    const living = this.users.filter((user) => !user.isDead);
    const candidates = living.length > 0 ? living : this.users;
    let highestUser = candidates[0];
    candidates.forEach((user) => {
      if (user.aggro > highestUser.aggro) {
        highestUser = user;
      }
    });
    return highestUser;
  }

  private decreasePlayersAggro() {
    this.users.forEach((user) => {
      user.aggro = Math.floor(user.aggro * 0.8);
    });
  }
  private decreasePlayerCooldown() {
    const currentTurn = this.attackerList[this.attackerTurn];
    const user = this.users.find((u) => u.name === currentTurn);
    if (user) {
      user.learnedSkills.forEach((ls) => {
        if (ls.cooldown && ls.cooldown > 0) {
          ls.cooldown -= 1;
        }
      });
      return;
    }
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
      if (this.spendSecondWind(args.user)) return;
      args.user.stats.health = 0;
      args.user.isDead = true;
    }
  }

  /**
   * A Revive Draught catches the blow that would have killed you and is used up
   * doing it. This is the thing a party can buy instead of bringing a Priest:
   * one death undone, paid for in silver rather than a party slot.
   */
  private spendSecondWind(user: UserWithStats) {
    const index = user.buffs.findIndex(({ buff }) => buff.effect === BuffEffect.SecondWind);
    if (index < 0) return false;

    const [{ buff }] = user.buffs.splice(index, 1);
    user.stats.health = Math.max(Math.floor(user.stats.maxHealth * SECOND_WIND_HEALTH), 1);
    this.pushLog({
      icon: buff.image,
      log: `${user.name} was pulled back from death and stands at ${user.stats.health} health`,
    });
    return true;
  }

  private async processMonsterAttack() {
    const attackerList = this.attackerList;
    const attackerIndex = this.attackerTurn;
    const attacker = attackerList[attackerIndex];

    const monster = this.monsters.find((m) => m.name === attacker);
    const isMonsterAlive = monster?.health > 0;

    if (monster && isMonsterAlive) {
      // Everything the party stuck on it is paid out at the top of its own turn,
      // so a two-turn debuff is two of its swings whatever the party size.
      this.burnPoison(monster);
      const stunned = isStunned(monster);
      tickDebuffs(monster);

      // Losing the turn still ends it — otherwise a stunned monster holds the
      // order and the fight stops moving until the stun is ticked off by
      // something that never runs.
      if (stunned || monster.health <= 0) {
        if (stunned && monster.health > 0) {
          this.pushLog({ log: `${monster.name} is unable to act`, icon: monster.image });
        }
        return this.afterDamageStep();
      }

      const monsterDamage = debuffedAttack(monster, this.enrageMonsterDamage(monster));
      const targetUser = this.getHighestAggroPlayer();
      return this.beforeDamageStep({
        attacker: 'monster',
        monster: monster,
        user: targetUser,
        damage: {
          image: 'https://kidmortal.sirv.com/skills/attack.webp',
          name: '',
          value: monsterDamage,
          aggro: 0,
        },
      });
    }
    return false;
  }

  /**
   * Poison ticking. It is not credited to anyone's damage total: the guild boss
   * pays out on hits landed, and a burn that kept paying after its caster left
   * the fight would be a second, unbudgeted damage source in that ledger.
   */
  private burnPoison(monster: MonsterInBattle) {
    const damage = poisonDamage(monster);
    if (damage <= 0) return;

    monster.health -= damage;
    this.pushLog({
      log: `${monster.name} takes ${damage} damage from poison`,
      icon: monster.debuffs.find((debuff) => debuff.effect === DebuffEffect.Poison)?.image ?? monster.image,
    });
  }

  /**
   * Past the enrage round every swing lands harder than the last, so a boss the
   * party cannot kill will eventually kill them instead of the fight running on
   * forever.
   */
  private enrageMonsterDamage(monster: MonsterWithDrops) {
    if (!this.isEnraged) return monster.attack;

    const damage = BattleUtils.enragedDamage(monster.attack, this.enrageStacks, ENRAGE_DAMAGE_MULTIPLIER);
    if (this.enrageStacks === 0) {
      this.pushLog({ log: `${monster.name} is enraged and hits harder every turn`, icon: monster.image });
    }
    this.enrageStacks += 1;
    return damage;
  }

  private async processNextTurn() {
    const maxIndex = this.attackerList.length - 1;
    if (maxIndex < 0) return this.attackerTurn;

    // Bounded by the length of the order, so a fight in which nobody can act
    // advances one slot rather than spinning.
    for (let step = 0; step <= maxIndex; step++) {
      if (this.attackerTurn < maxIndex) {
        this.attackerTurn += 1;
      } else {
        // Back to the top of the order: everyone has had their turn.
        this.attackerTurn = 0;
        this.round += 1;
        // Threat decays once a round rather than once a hit — decaying per hit
        // meant a five-player party shredded the tank's lead five times over.
        this.decreasePlayersAggro();
      }
      if (this.canAct(this.attackerList[this.attackerTurn])) break;
    }
    return this.attackerTurn;
  }

  /** Whether whoever holds this slot in the order is still in a state to use it. */
  private canAct(name: string) {
    const user = this.users.find((u) => u.name === name);
    if (user) return !user.isDead;
    const monster = this.monsters.find((m) => m.name === name);
    if (monster) return monster.health > 0;
    return false;
  }

  private isUserTurn(args: { email: string }) {
    const user = this.getUserFromBattle(args.email);
    const attackerList = this.attackerList;
    const attackerIndex = this.attackerTurn;
    const attacker = attackerList[attackerIndex];

    // The dead hold their slot in the order but cannot spend it. Until a Priest
    // brings them back, that is the whole cost of dying.
    return user && !user.isDead && attacker === user.name;
  }

  private getSkillFromUser(args: { email: string; skillId: number }) {
    const user = this.getUserFromBattle(args.email);
    const castingSkill = user.learnedSkills.find((skill) => skill.skillId === args.skillId);
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
            buff,
            battle: this,
          });
        });
      }
    }
    if (args.attacker === 'user') {
      if (args.user.buffs.length > 0) {
        args.user.buffs.forEach(({ buff }) => {
          runEffect({
            effect: buff.effect,
            dmgStep: args,
            role: 'attacker',
            image: buff.image,
            buff,
            battle: this,
          });
        });
      }
      if (args.damage.skill) {
        const userSkill = args.damage.skill;
        args.user.stats.mana -= userSkill.skill.manaCost;
      }
    }
    if (!args.skipDamageStep) {
      return this.startDamageStep(args);
    } else {
      return this.endDamageStep(args);
    }
  }

  /**
   * Ends the turn, unless this hit is one of several an area skill is still
   * working through — those all land inside a single turn.
   */
  private endDamageStep(args: DamageStepParams) {
    if (args.deferTurnEnd) return true;
    return this.afterDamageStep();
  }

  private startDamageStep(params: DamageStepParams) {
    const { attacker, damage, user, monster } = params;
    const randomDmg = Utils.randomDamage(damage.value, 20);
    if (attacker === 'user') {
      user.aggro += damage.aggro;

      if (this.isEvaded(monster.agi)) {
        this.pushLog({ log: `${monster.name} evaded ${user.name}'s attack`, icon: damage.image });
        return this.endDamageStep(params);
      }

      const dealt = BattleUtils.mitigate({
        raw: randomDmg,
        // Shredded armour is read here rather than written onto the monster, so
        // the debuff wearing off restores it without anything to unwind.
        defense: debuffedDefense(monster),
        attackerLevel: user.stats.level,
      });
      // Aggro decays every round; this is the running total the guild boss pays out on.
      this.damageDealt[user.email] = (this.damageDealt[user.email] ?? 0) + Math.max(dealt, 0);
      monster.health -= dealt;
      this.pushLog({
        log: `${user.name} Dealt ${dealt} damage to ${monster.name}`,
        icon: damage.image,
      });
    }
    if (attacker === 'monster') {
      if (this.isEvaded(user.stats.agi)) {
        this.pushLog({ log: `${user.name} evaded ${monster.name}'s attack`, icon: damage.image });
        return this.endDamageStep(params);
      }

      const taken = BattleUtils.mitigate({
        raw: randomDmg,
        defense: BattleUtils.effectiveDefense(user.stats),
        attackerLevel: monster.level,
      });
      this.damageUser({ user: user, amount: taken });
      this.pushLog({
        log: `${monster.name} Dealt ${taken} damage to ${user.name}`,
        icon: damage.image,
      });
    }
    this.endDamageStep(params);
  }

  /** A dodge, rolled off agility and capped hard so speed can never mean immunity. */
  private isEvaded(agi?: number) {
    return Math.random() < BattleUtils.evasionChance(agi ?? 0);
  }

  private afterDamageStep() {
    this.settleBattleAndProcessRewards();
    this.decreaseOrRemoveBuffs();
    this.decreasePlayerCooldown();
    this.processNextTurn();
    this.notifyUsers();
    return true;
  }

  private decreaseOrRemoveBuffs() {
    const currentTurn = this.attackerList[this.attackerTurn];
    const user = this.users.find((u) => u.name === currentTurn);
    if (user) {
      // Ticked on the player's own UserBuff row, never on the Buff template the
      // skill points at — mutating that drained the second cast of a buff by as
      // much as the first had already used up.
      user.buffs.forEach((userBuff) => (userBuff.duration -= 1));
      user.buffs = user.buffs.filter((userBuff) => userBuff.duration >= 1);
      return;
    }
    // A monster's debuffs are not ticked here: they are paid out at the top of
    // its turn in processMonsterAttack, which is the only place that still runs
    // when the monster is stunned out of acting.
  }

  private async settleBattleAndProcessRewards() {
    if (this.battleFinished) {
      this.removeBattle();
      this.notifyBattleRemoved();
      return;
    }
    const monsterAlive = this.isMonsterAlive;
    const userAlive = this.isPlayersAlive;
    if (monsterAlive && userAlive) {
      this.notifyUsers();
      return;
    }
    if (monsterAlive && !userAlive) {
      // A wipe ends the fight as surely as a kill does. Leaving it unfinished is
      // what left lost battles stuck in the list for an admin to clear by hand.
      this.userLost = true;
      this.battleFinished = true;
      this.notifyUsers();
      return;
    }
    this.generateBattleDrops();
    await this.updateUsers(this);
    this.battleFinished = true;
    this.notifyUsers();
  }
  /**
   * A copy per monster, because a pull can contain two of the same row and the
   * map cache hands out the object it is holding — sharing it would mean one
   * Poring's health bar dropping when the other one is hit.
   */
  private generateMonsterBattleValues(monsters: MonsterWithDrops[]): MonsterInBattle[] {
    return monsters.map((monster) => ({
      ...monster,
      maxHealth: monster.health,
      debuffs: [],
    }));
  }

  private generateUserBattleValues(users: UserWithStats[]) {
    users.forEach((user) => {
      user.aggro = 0;
      user.learnedSkills.forEach((ls) => {
        ls.cooldown = 0;
      });
    });
    return users;
  }

  /**
   * The named monster, as long as it is still standing. A client pointing at a
   * corpse — the pack it was aiming into died a turn ago — falls through to
   * whatever is left rather than spending the turn hitting nothing.
   */
  private getMonsterTarget(name: string) {
    const named = this.monsters.find((m) => m.name === name && m.health > 0);
    return named ?? this.defaultMonsterTarget();
  }

  /** Who an untargeted attack lands on: the first monster still standing. */
  private defaultMonsterTarget() {
    return this.aliveMonsters[0];
  }
  private getUserTarget(name: string) {
    return this.users.find((u) => u.name === name);
  }
}
