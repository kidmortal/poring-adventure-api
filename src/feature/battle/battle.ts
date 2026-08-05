import { Buff, Debuff, Drop, Item, LearnedSkill, Monster, Skill, Stats, User, UserBuff } from '@prisma/client';
import { BattleUtils } from './battleUtils';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { Utils } from 'src/utilities/utils';
import { runEffect } from './effects';
import { absorbDamage, isSpentBarrier } from './barrier';
import { applyBuff, buffedAttack, buffedDamageTaken, regenerations, tickBuffs } from './buffs';
import { rollCritical } from './crit';
import {
  applyDebuff,
  BattleDebuff,
  burnDamage,
  clearDebuffs,
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
  /**
   * Puts the skill's buff on the whole party. The Priest's other half: healing
   * answers damage that has already landed, this answers the damage that has
   * not, and it is the only reason to bring one to a fight the party is winning.
   */
  BuffParty = 'buff_party',
  /**
   * A turn spent making the enemy worse rather than smaller. The debuff lands
   * and nothing else does — no damage, and so no threat — which is what lets a
   * Priest weaken a boss without pulling it off the Knight.
   */
  DebuffEnemy = 'debuff_enemy',
}

enum SkillEffect {
  Healing = 'healing',
  Infusion = 'infusion',
  /**
   * Lifts what the fight has stuck on the party. It restores nothing, which is
   * the trade: against a clean party it is a wasted turn, and against a poisoned
   * one it is worth more than any single heal.
   */
  Cleanse = 'cleanse',
}

/** Buff effects the engine acts on directly rather than through `runEffect`. */
enum BuffEffect {
  SecondWind = 'second_wind',
  /**
   * A pool of borrowed health that is spent before the real one. Handled here
   * rather than in `runEffect` because it has to survive between damage steps:
   * what is left of it is state, not a multiplier applied to one hit.
   */
  Barrier = 'barrier',
  /**
   * Health handed back at the top of each of the holder's own turns. Like a
   * barrier it is state rather than a multiplier, and like a barrier its size is
   * locked in from the caster when it goes up — a Priest's blessing is worth
   * their intelligence, not the intelligence of whoever is carrying it.
   */
  Regeneration = 'regeneration',
}

/**
 * A player's debuff list as the queries want it. Optional on the type because
 * the object arrives from a cached profile that has never heard of a fight, and
 * a missing list means the same as an empty one.
 */
function debuffsOf(user: UserWithStats) {
  if (!user.debuffs) user.debuffs = [];
  return user as { debuffs: BattleDebuff[] };
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
  /** Whatever has been put *on* it. Lives for the fight and is never persisted. */
  buffs: UserBuffWithBuff[];
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
  /**
   * What has been stuck on the player. Battle-only, like the monster's: a
   * debuff is spent inside the fight it was applied in and there is no row for
   * it, which is what separates it from a buff.
   */
  debuffs?: BattleDebuff[];
};
type UserBuffWithBuff = UserBuff & {
  buff: Buff;
  /**
   * What is left of a barrier's pool. Set only on a barrier buff, and only at
   * the table: the amount comes from the caster's stats when it was raised, so
   * there is nothing to store on the Buff row and nothing to persist afterwards.
   */
  barrier?: number;
  /**
   * What a regeneration buff hands back each turn. Sized off the caster when it
   * went up, for the same reason a barrier is.
   */
  regen?: number;
};

type LearnedSkillWithSkill = LearnedSkill & {
  skill: SkillWithBuff;
  cooldown?: number;
};
type SkillWithBuff = Skill & {
  buff?: Buff;
  debuff?: Debuff;
};

/**
 * What the debug panel can do to a fight. Kept as a union rather than a handful
 * of methods so the gateway carries one event and the client one list.
 */
export type BattleDebugAction =
  | 'heal_allies'
  | 'hurt_allies'
  | 'kill_allies'
  | 'heal_monsters'
  | 'hurt_monsters'
  | 'buff_allies'
  | 'buff_monsters'
  | 'clear_buffs'
  | 'debuff_monsters'
  | 'debuff_allies'
  | 'clear_debuffs'
  | 'restore_mana'
  | 'drain_mana'
  | 'next_turn'
  | 'enrage';

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

/**
 * Which boss of which run this fight is, shipped with the battle so the client
 * can draw the party's place in the gauntlet without a second request.
 */
export type DungeonBattleInfo = {
  runId: number;
  name: string;
  /** The boss being fought, counted from 1. */
  stage: number;
  /** How many there are in all — the last one is the dungeon's real fight. */
  totalStages: number;
};

type CreateBattleParams = {
  users: UserWithStats[];
  monsters: MonsterWithDrops[];
  socket: WebsocketService;
  updateUsers: (battle: BattleInstance) => Promise<void>;
  removeBattle: () => Promise<boolean>;
  /** Set when the monster is a guild's standing boss, whose health pool is persisted. */
  guildBossGuildId?: number;
  /** Set when the fight is one leg of a dungeon run. */
  dungeon?: DungeonBattleInfo;
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
  readonly dungeon?: DungeonBattleInfo;
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
  /**
   * Anyone whose sheet is not merely hurt but impossible — a level below one or
   * a maximum health at or under zero. Nothing in the game should produce this;
   * it means a row has been corrupted, and starting a fight on top of it would
   * bury the evidence under a wipe.
   */
  get brokenMembers() {
    return this.users.filter((user) => user.stats.maxHealth <= 0 || user.stats.level < 1);
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
    dungeon,
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
    this.dungeon = dungeon;
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
      // Which leg of a dungeon run this is, so the results screen can offer the
      // next boss instead of a rematch.
      dungeon: this.dungeon,
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

  async processUserAttack(args: { email: string; targetName?: string }) {
    const isUserTurn = this.isUserTurn(args);

    if (isUserTurn) {
      const user = this.getUserFromBattle(args.email);
      // Named, when the player picked one off the board. `getMonsterTarget`
      // falls through to whatever is still standing if the pack they aimed at
      // died before the turn came round, so a stale pick never wastes a swing.
      const targetMonster = args.targetName ? this.getMonsterTarget(args.targetName) : this.defaultMonsterTarget();
      if (!targetMonster) return false;

      const { value: userDamage } = this.rollCrit({
        user,
        value: debuffedAttack(debuffsOf(user), user.stats.attack),
        icon: 'https://kidmortal.sirv.com/skills/attack.webp',
        log: `${user.name} lands a critical hit`,
      });

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
        case SkillCategory.BuffParty:
          return this.processCastBuffParty({ user, skill });
        case SkillCategory.DebuffEnemy:
          return this.processCastDebuffEnemy({
            user,
            skill,
            targetName: args.targetName,
          });

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
      // Its own copy, because decreaseOrRemoveBuffs ticks the buff object down
      // and a shared row would drain every drinker at once — and one entry per
      // name, so a second potion extends the first rather than doubling it.
      applyBuff({ target: user, buff: args.buff, duration: args.buffDuration });
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
      // Every target of an area cast rolls its own crit — one unlucky roll for
      // the whole screen would make the skill swing far harder than it should.
      const { value: targetDamage } = this.rollCrit({
        user: args.user,
        value: userDamage,
        icon: args.skill.skill.image,
        log: `${args.skill.skill.name} critically strikes ${monster.name}`,
      });
      this.beforeDamageStep({
        attacker: 'user',
        monster,
        user: args.user,
        damage: {
          image: args.skill.skill.image,
          name: '',
          value: targetDamage,
          skill: areaCast ? undefined : args.skill,
          // Threat is no longer the same thing as damage: a skill decides how
          // loudly it lands, which is the only reason a tank can hold a boss it
          // is not out-damaging anyone with.
          aggro: Math.floor(targetDamage * (args.skill.skill.threatModifier ?? 1)),
        },
        deferTurnEnd: index < targets.length - 1,
      });
    });
    return true;
  }

  /**
   * Rolls a critical for whatever the user is about to land, and says so in the
   * log when it happens. Every damaging and healing path goes through here, so
   * a crit reads the same wherever it comes from — and buffs are conspicuously
   * not among the callers, which is the rule rather than an oversight.
   */
  private rollCrit(args: { user: UserWithStats; value: number; icon: string; log: string }) {
    const rolled = rollCritical({ value: args.value, stats: args.user.stats, buffs: args.user.buffs });
    if (rolled.critical) {
      this.pushLog({ icon: args.icon, log: args.log });
    }
    return rolled;
  }

  /** Sticks whatever the skill carries onto the monster it just landed on. */
  private applySkillDebuff(args: { user: UserWithStats; skill: LearnedSkillWithSkill; monster: MonsterInBattle }) {
    const debuff = args.skill.skill.debuff;
    if (!debuff) return;

    if (
      applyDebuff({
        target: args.monster,
        debuff,
        // A burn is the only debuff sized off the caster rather than off what it
        // lands on, so it is locked in here the way a barrier's pool is.
        amount: debuff.effect === DebuffEffect.Burn ? this.castAmount(args.user, args.skill) : undefined,
      })
    ) {
      this.pushLog({
        icon: debuff.image,
        log: `${args.monster.name} is afflicted with ${debuff.name} by ${args.user.name}`,
      });
    }
  }

  /**
   * A curse and nothing else: the skill's debuff lands on one monster, or on
   * every one standing when it is an area cast, and the turn ends.
   *
   * No damage, and deliberately no threat with it. A cast that generated aggro
   * off a number it never dealt would have to invent one, and a support who
   * weakens a boss should not end up holding it — the party's whole reason for
   * a Knight is that threat is bought on purpose, by the class that can survive
   * being looked at.
   */
  private async processCastDebuffEnemy(args: {
    user: UserWithStats;
    skill: LearnedSkillWithSkill;
    targetName?: string;
  }) {
    const debuff = args.skill.skill.debuff;
    const targets = args.skill.skill.areaOfEffect
      ? this.aliveMonsters
      : [args.targetName ? this.getMonsterTarget(args.targetName) : this.defaultMonsterTarget()].filter(Boolean);

    // Nothing left to curse. Refunded rather than eaten, the same way a damage
    // cast into an empty table is.
    if (targets.length === 0 || !debuff) return false;

    args.user.stats.mana -= args.skill.skill.manaCost;
    this.pushLog({
      icon: args.skill.skill.image,
      log: `${args.user.name} cast ${args.skill.skill.name}`,
    });
    targets.forEach((monster) => this.applySkillDebuff({ user: args.user, skill: args.skill, monster }));

    return this.afterDamageStep();
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
        const { value: potency } = this.rollCrit({
          user: args.user,
          value: Utils.randomDamage(rawPotency, 20),
          icon: args.skill.skill.image,
          log: `${args.user.name} lands a critical heal on ${targetAlly.name}`,
        });
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

    // A cleanse restores nothing, so it reads none of the potency above — what
    // it is worth is whatever the fight has managed to stick on the party, and
    // the dead are skipped because a corpse's poison has stopped mattering.
    if (args.skill.skill.effect === SkillEffect.Cleanse) {
      const targets = areaCast
        ? this.users.filter((user) => !user.isDead)
        : [args.targetName ? this.getUserTarget(args.targetName) : this.getMostAfflictedMember()];

      targets.forEach((targetAlly) => {
        const lifted = clearDebuffs(debuffsOf(targetAlly));
        if (lifted.length === 0) return;
        this.pushLog({
          log: `${args.user.name} cleansed ${lifted.map((debuff) => debuff.name).join(', ')} from ${targetAlly.name}`,
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
      const { value: healed } = this.rollCrit({
        user: args.user,
        value: potency,
        icon: args.skill.skill.image,
        log: `${args.user.name} lands a critical heal on themselves`,
      });
      this.healUser({ user: args.user, amount: healed });
      this.pushLog({
        log: `${args.user.name} Recovered ${healed} Health Points`,
        icon: args.skill.skill.image,
      });
    }

    // Infusion is left plain on purpose: mana is a budget, not a health bar, and
    // a crit that occasionally handed a caster a free extra cast would be worth
    // more than any amount of crit damage.
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
      this.grantBuff({ target: args.user, caster: args.user, skill: args.skill });
      this.pushLog({
        log: `${args.user.name} Casted ${args.skill.skill.buff.name} on himself`,
        icon: args.skill.skill.image,
      });
    }
    return this.afterDamageStep();
  }

  /**
   * The party-wide blessing. The dead are skipped — a buff on a corpse is a turn
   * the party needed — and everyone who is up gets their own copy, sized off the
   * caster, so it ticks down on each of their own turns rather than in lockstep.
   */
  private async processCastBuffParty(args: { user: UserWithStats; skill: LearnedSkillWithSkill }) {
    args.user.stats.mana -= args.skill.skill.manaCost;
    const buff = args.skill.skill.buff;
    if (!buff) return this.afterDamageStep();

    const targets = this.users.filter((user) => !user.isDead);
    targets.forEach((target) => this.grantBuff({ target, caster: args.user, skill: args.skill }));

    this.pushLog({
      log: `${args.user.name} Casted ${buff.name} on the party`,
      icon: args.skill.skill.image,
    });
    return this.afterDamageStep();
  }

  /**
   * Hands one player a copy of a skill's buff.
   *
   * The copy matters: `decreaseOrRemoveBuffs` ticks the object it is given, and
   * a party sharing one row would drain everyone's blessing on the first
   * player's turn.
   */
  private grantBuff(args: { target: UserWithStats; caster: UserWithStats; skill: LearnedSkillWithSkill }) {
    const buff = args.skill.skill.buff;
    applyBuff({
      target: args.target,
      buff,
      // A barrier is worth whatever the caster's stats made it worth when it went
      // up. Locking the size in here is what lets a Priest's shield outlive the
      // turn they cast it on without re-reading stats that may since have moved.
      barrier: buff.effect === BuffEffect.Barrier ? this.castAmount(args.caster, args.skill) : undefined,
      // Regeneration is locked in the same way and for the same reason: the
      // blessing is worth the intelligence of whoever cast it.
      regen: buff.effect === BuffEffect.Regeneration ? this.castAmount(args.caster, args.skill) : undefined,
    });
  }

  /** What a cast is worth: the same `attribute × multiplier × mastery` every skill uses. */
  private castAmount(caster: UserWithStats, skill: LearnedSkillWithSkill) {
    const casterAttribute: number = caster.stats[skill.skill.attribute];
    return Math.max(1, Math.floor(casterAttribute * skill.skill.multiplier * skill.masteryLevel));
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

  /**
   * Who an untargeted cleanse lands on: whoever is carrying the most. Counted
   * rather than weighed, because a stun and a poison are not comparable and the
   * player who has collected three of them is the one in trouble either way.
   */
  private getMostAfflictedMember() {
    const living = this.users.filter((user) => !user.isDead);
    const candidates = living.length > 0 ? living : this.users;
    return candidates.reduce((worst, user) =>
      (user.debuffs?.length ?? 0) > (worst.debuffs?.length ?? 0) ? user : worst,
    );
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
    const amount = this.absorbWithBarrier(args);
    if (amount <= 0) return;

    args.user.stats.health -= amount;
    if (args.user.stats.health <= 0) {
      if (this.spendSecondWind(args.user)) return;
      args.user.stats.health = 0;
      args.user.isDead = true;
    }
  }

  /**
   * Spends a hit against whatever barriers the player is carrying and returns
   * what is left over for their real health.
   *
   * Borrowed health rather than mitigation: it is a flat pool, so it is worth
   * most against the many small hits a pack throws out and least against one
   * enormous one — the opposite of the defense curve, which is what makes it
   * worth casting on a party that is already armoured.
   *
   * Oldest barrier first, so a fresh one is not wasted covering a hit the
   * expiring one could have taken.
   */
  private absorbWithBarrier(args: { user: UserWithStats; amount: number }) {
    const { remaining, absorptions } = absorbDamage({ buffs: args.user.buffs, amount: args.amount });

    absorptions.forEach(({ name, image, absorbed }) =>
      this.pushLog({ icon: image, log: `${name} absorbed ${absorbed} damage for ${args.user.name}` }),
    );
    args.user.buffs = args.user.buffs.filter((userBuff) => !isSpentBarrier(userBuff));
    return remaining;
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
      tickBuffs(monster);

      // Losing the turn still ends it — otherwise a stunned monster holds the
      // order and the fight stops moving until the stun is ticked off by
      // something that never runs.
      if (stunned || monster.health <= 0) {
        if (stunned && monster.health > 0) {
          this.pushLog({ log: `${monster.name} is unable to act`, icon: monster.image });
        }
        return this.afterDamageStep();
      }

      // Its own buffs raise the swing, whatever the party has stuck on it lowers it.
      const monsterDamage = debuffedAttack(monster, buffedAttack(monster, this.enrageMonsterDamage(monster)));
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
   * Poison and burn ticking. Neither is credited to anyone's damage total: the
   * guild boss pays out on hits landed, and a tick that kept paying after its
   * caster left the fight would be a second, unbudgeted damage source in that
   * ledger.
   */
  private burnPoison(monster: MonsterInBattle) {
    const damage = poisonDamage({ carrier: monster, maxHealth: monster.maxHealth }) + burnDamage(monster);
    if (damage <= 0) return;

    monster.health -= damage;
    this.pushLog({
      log: `${monster.name} takes ${damage} damage from poison`,
      icon: this.tickIcon(monster) ?? monster.image,
    });
  }

  /** Whichever tick is doing the damage gets to put its own icon on the log. */
  private tickIcon(carrier: { debuffs: BattleDebuff[] }) {
    return carrier.debuffs.find(
      (debuff) => debuff.effect === DebuffEffect.Poison || debuff.effect === DebuffEffect.Burn,
    )?.image;
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
      const name = this.attackerList[this.attackerTurn];
      if (!this.canAct(name)) continue;
      // A player's own debuffs are paid at the top of their turn, exactly as a
      // monster's are at the top of its own — and a stun costs the turn, which
      // means looking for the next slot rather than stopping here.
      if (await this.startPlayerTurn(name)) break;
    }
    return this.attackerTurn;
  }

  /**
   * Whether whoever holds this slot may use it, once what is stuck on them has
   * been paid. Monsters answer for themselves in `processMonsterAttack`, so a
   * slot that is not a player's passes straight through.
   */
  private async startPlayerTurn(name: string) {
    const user = this.users.find((u) => u.name === name);
    if (!user) return true;

    // The blessing is paid before the venom, so a regeneration big enough to
    // out-heal a poison saves the player it was cast on rather than arriving on
    // a corpse a moment too late.
    if (!user.isDead) this.regenerateUser(user);
    this.burnPlayerPoison(user);
    if (!this.isPlayersAlive) {
      // Burned down the last of the party: the fight is over, and settling it
      // here is what stops the order advancing into an empty table.
      await this.settleBattleAndProcessRewards();
      return true;
    }
    if (user.isDead) return false;

    const stunned = isStunned(debuffsOf(user));
    tickDebuffs(debuffsOf(user));
    if (stunned) {
      this.pushLog({ log: `${user.name} is unable to act` });
      return false;
    }
    return true;
  }

  /**
   * A regeneration buff paying out at the top of its holder's turn — the mirror
   * of poison, and ticked in the same place so a blessing lasting three turns is
   * three of *their* turns whatever the party size.
   *
   * What is logged is what actually landed, so a heal into a full health bar
   * says nothing rather than claiming a number the player never got.
   */
  private regenerateUser(user: UserWithStats) {
    regenerations(user).forEach(({ name, image, amount }) => {
      const before = user.stats.health;
      this.healUser({ user, amount });
      const restored = user.stats.health - before;
      if (restored <= 0) return;
      this.pushLog({ icon: image, log: `${name} restored ${restored} health to ${user.name}` });
    });
  }

  /** The same two ticks on a player: a share of the pool they walked in with, plus any flat burn. */
  private burnPlayerPoison(user: UserWithStats) {
    const damage =
      poisonDamage({ carrier: debuffsOf(user), maxHealth: user.stats.maxHealth }) + burnDamage(debuffsOf(user));
    if (damage <= 0) return;

    this.damageUser({ user, amount: damage });
    this.pushLog({
      log: `${user.name} takes ${damage} damage from poison`,
      icon: this.tickIcon(debuffsOf(user)),
    });
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
        defense: debuffedDefense(monster, monster.defense),
        attackerLevel: user.stats.level,
      });
      // Whatever the monster is wearing takes its share before the health does.
      const landed = buffedDamageTaken(monster, dealt);
      // Aggro decays every round; this is the running total the guild boss pays out on.
      this.damageDealt[user.email] = (this.damageDealt[user.email] ?? 0) + Math.max(landed, 0);
      monster.health -= landed;
      this.pushLog({
        log: `${user.name} Dealt ${landed} damage to ${monster.name}`,
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
        // A player's armour is shredded the same way a monster's is — read at
        // the moment of the hit, so nothing has to be unwound when it expires.
        defense: debuffedDefense(debuffsOf(user), BattleUtils.effectiveDefense(user.stats)),
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

  /**
   * Drops everything still standing and settles the fight as a won one.
   *
   * An admin tool, for testing what a kill leads to — the drops, the rewards, a
   * dungeon's next stage, a guild boss's banked damage — without playing the
   * fight out first. It deliberately goes through the same settle step a real
   * killing blow does, so whatever it produces is what a player would have got;
   * anything cheaper would be testing a path the game does not have.
   *
   * Buffs are not ticked and the turn does not advance, because no turn was
   * taken: the monsters simply stop being alive.
   *
   * The blow is *dealt*, not declared — the remaining health is run through the
   * same per-player tally a real hit feeds. A guild boss banks what the party
   * hit it for, so setting health to zero and nothing else left the pool full,
   * paid nobody and never killed the boss. Credit goes to the admin when they
   * are in the fight and to whoever is when they are not, because the tally is
   * what `applyDamage` pays out on and a stranger's row does not belong in it.
   */
  async forceKillMonsters(args: { by: string; credit?: string }) {
    if (this.battleFinished) return false;
    if (!this.isMonsterAlive) return false;

    const creditEmail = args.credit && this.hasUser(args.credit) ? args.credit : this.users[0]?.email;

    this.aliveMonsters.forEach((monster) => {
      const remaining = Math.max(monster.health, 0);
      if (creditEmail) {
        this.damageDealt[creditEmail] = (this.damageDealt[creditEmail] ?? 0) + remaining;
      }
      monster.health = 0;
      this.pushLog({ icon: monster.image, log: `${monster.name} was struck down by ${args.by}` });
    });

    await this.settleBattleAndProcessRewards();
    return true;
  }

  /**
   * Everything an admin can do to a fight from the debug panel.
   *
   * None of these take a turn. A fight is a state machine driven by turns, and
   * an inspection tool that advanced it would change the very thing being
   * inspected — so each action mutates the table and pushes, and the turn order
   * is left exactly where it was. `next_turn` is the deliberate exception, and
   * says so in its name.
   *
   * Both catalogue rows arrive from the caller rather than being looked up
   * here: the engine has no database, which is the rule that keeps it testable.
   */
  async runDebugAction(args: {
    action: BattleDebugAction;
    by: string;
    buff?: Buff;
    debuff?: Debuff;
    /** Health or mana moved, where the action moves an amount. */
    amount?: number;
  }) {
    if (this.battleFinished) return false;
    const { action } = args;

    if (action === 'heal_allies') {
      this.users.forEach((user) => {
        user.stats.health = user.stats.maxHealth;
        user.stats.mana = user.stats.maxMana;
        // A revived player gets their slot in the order back with them.
        user.isDead = false;
      });
      this.pushLog({ log: `${args.by} restored the party` });
    }

    if (action === 'hurt_allies') {
      for (const user of this.users) {
        // Through the ordinary damage path, so barriers absorb and second wind
        // fires — the whole point is testing what a hit actually does.
        await this.damageUser({ user, amount: args.amount ?? Math.floor(user.stats.maxHealth / 2) });
      }
      this.pushLog({ log: `${args.by} wounded the party` });
    }

    if (action === 'kill_allies') {
      this.users.forEach((user) => {
        user.stats.health = 0;
        user.isDead = true;
      });
      this.pushLog({ log: `${args.by} struck the party down` });
      await this.settleBattleAndProcessRewards();
      return true;
    }

    if (action === 'heal_monsters') {
      this.monsters.forEach((monster) => (monster.health = monster.maxHealth));
      this.pushLog({ log: `${args.by} restored the enemy` });
    }

    if (action === 'hurt_monsters') {
      this.aliveMonsters.forEach((monster) => {
        const dealt = args.amount ?? Math.floor(monster.maxHealth / 3);
        monster.health = Math.max(monster.health - dealt, 0);
        // Banked like any other hit, so a guild boss pays out on it.
        this.damageDealt[args.by] = (this.damageDealt[args.by] ?? 0) + dealt;
      });
      this.pushLog({ log: `${args.by} wounded the enemy` });
      await this.settleBattleAndProcessRewards();
      return true;
    }

    if (action === 'buff_allies') {
      if (!args.buff) return false;
      this.users.forEach((user) => this.grantDebugBuff({ target: user, buff: args.buff }));
      this.pushLog({ icon: args.buff.image, log: `${args.by} granted ${args.buff.name} to the party` });
    }

    if (action === 'buff_monsters') {
      if (!args.buff) return false;
      this.aliveMonsters.forEach((monster) => applyBuff({ target: monster, buff: args.buff }));
      this.pushLog({ icon: args.buff.image, log: `${args.by} granted ${args.buff.name} to the enemy` });
    }

    if (action === 'clear_buffs') {
      this.users.forEach((user) => (user.buffs = []));
      this.monsters.forEach((monster) => (monster.buffs = []));
      this.pushLog({ log: `${args.by} stripped every buff` });
    }

    if (action === 'debuff_monsters') {
      if (!args.debuff) return false;
      this.aliveMonsters.forEach((monster) =>
        applyDebuff({ target: monster, debuff: args.debuff, amount: this.debugBurn(monster.maxHealth) }),
      );
      this.pushLog({ icon: args.debuff.image, log: `${args.by} afflicted the enemy with ${args.debuff.name}` });
    }

    if (action === 'debuff_allies') {
      if (!args.debuff) return false;
      this.users.forEach((user) =>
        applyDebuff({
          target: debuffsOf(user),
          debuff: args.debuff,
          amount: this.debugBurn(user.stats.maxHealth),
        }),
      );
      this.pushLog({ icon: args.debuff.image, log: `${args.by} afflicted the party with ${args.debuff.name}` });
    }

    if (action === 'clear_debuffs') {
      this.monsters.forEach((monster) => (monster.debuffs = []));
      this.users.forEach((user) => (user.debuffs = []));
      this.pushLog({ log: `${args.by} cleansed everyone` });
    }

    if (action === 'restore_mana') {
      this.users.forEach((user) => (user.stats.mana = user.stats.maxMana));
      this.pushLog({ log: `${args.by} refilled the party's mana` });
    }

    if (action === 'drain_mana') {
      this.users.forEach((user) => (user.stats.mana = 0));
      this.pushLog({ log: `${args.by} drained the party's mana` });
    }

    if (action === 'next_turn') {
      // The one action that moves the fight on, because passing the turn is the
      // thing being tested.
      await this.processNextTurn();
      this.pushLog({ log: `${args.by} passed the turn` });
    }

    if (action === 'enrage') {
      this.enrageStacks += 1;
      this.pushLog({ log: `${args.by} enraged the enemy (stack ${this.enrageStacks})` });
    }

    this.notifyUsers();
    return true;
  }

  /**
   * A buff handed out by an admin rather than cast by a skill.
   *
   * A barrier's pool and a regeneration's payout normally come off the caster's
   * stats through the skill that raised them; there is no skill here, so both are
   * sized off the holder's own health — enough to be visible and to be spent,
   * which is what a test needs.
   */
  /**
   * What a burn dropped from the debug panel is worth. A cast one carries the
   * caster's number and there is no caster here, so it is a twentieth of the bar
   * it is sitting on — visible over the few turns a test runs, and harmless.
   */
  private debugBurn(maxHealth: number) {
    return Math.max(1, Math.floor(maxHealth / 20));
  }

  private grantDebugBuff(args: { target: UserWithStats; buff: Buff }) {
    const sizedOffHolder = Math.max(1, Math.floor(args.target.stats.maxHealth / 2));
    applyBuff({
      target: args.target,
      buff: args.buff,
      barrier: args.buff.effect === BuffEffect.Barrier ? sizedOffHolder : undefined,
      // A tenth of the bar a turn: enough to watch it tick without a debug
      // blessing out-healing whatever is being tested.
      regen:
        args.buff.effect === BuffEffect.Regeneration
          ? Math.max(1, Math.floor(args.target.stats.maxHealth / 10))
          : undefined,
    });
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
      buffs: [],
    }));
  }

  private generateUserBattleValues(users: UserWithStats[]) {
    users.forEach((user) => {
      user.aggro = 0;
      // Never carried in from the last fight: a debuff is spent inside the one
      // that applied it, and the cached profile these come from may still be
      // holding the list a previous battle left on it.
      user.debuffs = [];
      // Nor is a buff a skill put up. Only what was eaten beforehand survives
      // between fights — those are rows in the database, and `persist` is what
      // says so. A blessing cast last fight is not a standing stat, and the
      // profile these arrive on is a cached object a previous battle may have
      // pushed one onto.
      user.buffs = (user.buffs ?? []).filter((held) => held.buff.persist);
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
