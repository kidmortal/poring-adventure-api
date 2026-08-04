import { UsersRepository } from 'src/feature/users/users.repository';
import { UserWalletService } from 'src/feature/users/userWallet.service';
import { UserStatsService } from 'src/feature/users/userStats.service';
import { Injectable, Logger } from '@nestjs/common';

import { BattleInstance, UserWithStats } from './battle';
import { MonstersService } from 'src/feature/monsters/monsters.service';
import { UsersService } from 'src/feature/users/users.service';
import { InventoryService } from 'src/feature/items/inventory.service';
import { buffDurationForQuality, consumablePotency } from 'src/feature/items/items.rules';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { Cron } from '@nestjs/schedule';
import { PartyService } from 'src/feature/party/party.service';
import { PartyRepository } from 'src/feature/party/party.repository';
import { BattleValidations } from './validators';
import { GuildService } from 'src/feature/guild/guild.service';
import { GuildTaskService } from 'src/feature/guild/guildTask.service';
import { GuildBossService } from 'src/feature/guild/guildBoss.service';
import { DungeonService } from 'src/feature/dungeon/dungeon.service';
import { DungeonMonsterWithDrops, toBattleMonster } from 'src/feature/dungeon/dungeon.rules';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { TRANSACTION_OPTIONS } from 'src/core/prisma/types/prisma';

/**
 * The guild boss carries a pool far too big for one party, so it turns on them
 * after five rounds rather than letting an unwinnable fight drag on. The damage
 * banked up to that point is kept either way.
 */
const GUILD_BOSS_ENRAGE_ROUND = 5;

/**
 * The largest pack a map battle can hand out. A boss ignores it entirely — it is
 * always fought alone — and every extra monster is a full share of drops and
 * experience, so this is the ceiling on how much a single pull can be worth.
 */
const MAX_PULL_SIZE = 3;

/**
 * A dungeon boss turns on the party far later than a guild boss does — it has a
 * health pool one party is actually meant to finish, so the enrage is only
 * there to end a stalemate rather than to cap the fight.
 */
const DUNGEON_ENRAGE_ROUND = 12;

@Injectable()
export class BattleService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly userWallet: UserWalletService,
    private readonly userStats: UserStatsService,
    private readonly monsterService: MonstersService,
    private readonly userService: UsersService,
    private readonly partyService: PartyService,
    private readonly partyRepository: PartyRepository,
    private readonly inventory: InventoryService,
    private readonly guildService: GuildService,
    private readonly guildTaskService: GuildTaskService,
    private readonly guildBossService: GuildBossService,
    private readonly dungeonService: DungeonService,
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
      const userData = await this.usersRepository.getFullUser({
        userEmail: args.userEmail,
      });
      if (userData.partyId) {
        const fullPartyInfo = await this.partyRepository.getPartyFromId({ partyId: userData.partyId });
        const partyMembers = fullPartyInfo.members;
        users = partyMembers;
      } else {
        users = [userData];
      }
      // A pull rather than a single monster — unless the map handed out its
      // boss, which is always fought alone.
      const monsters = await this.monsterService.findPullFromMap({
        mapId: args.mapId,
        maxSize: MAX_PULL_SIZE,
      });
      // An unknown or empty map has nothing to fight, and a battle built around
      // a missing monster throws deeper in on its first health check.
      if (monsters.length === 0) {
        this.socket.sendErrorNotification({
          email: args.userEmail,
          text: 'There is nothing to fight on that map',
        });
        return false;
      }
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

  /**
   * The guild boss fight. Unlike a map battle it is gated before it starts —
   * one entry per member per UTC day, guild members only — and what it does to
   * the boss is banked against a health pool that outlives the battle.
   */
  async createGuildBossBattle(args: { userEmail: string }) {
    const battle = this.getUserBattle(args.userEmail);
    if (battle) {
      battle.notifyUsers();
      return true;
    }

    const { users, partyLeaderEmail } = await this._gatherParty(args.userEmail);

    const prepared = await this.guildBossService.prepareFight({
      userEmail: args.userEmail,
      partyEmails: users.map((user) => user.email),
    });
    if (!prepared) return false;

    const { boss } = prepared;
    // The monster is built for this fight only: the health it stands up with is
    // whatever the guild has left it, and it drops nothing on its own.
    const monster = {
      id: -boss.id,
      name: boss.boss.name,
      image: boss.boss.image,
      level: boss.boss.level,
      boss: true,
      attack: boss.attack,
      health: boss.health,
      agi: boss.boss.agi,
      defense: boss.boss.defense,
      silver: boss.boss.silver,
      exp: boss.boss.exp,
      mapId: 0,
      drops: [],
    };

    const newBattleInstance = new BattleInstance({
      socket: this.socket,
      users,
      monsters: [monster],
      updateUsers: (b) => this.updateStatsAndRewards(b),
      removeBattle: () => this._remove(args.userEmail),
      guildBossGuildId: prepared.guildId,
      enrageAfterRound: GUILD_BOSS_ENRAGE_ROUND,
      partyLeaderEmail,
    });
    BattleValidations.validateBattleInstanceStart(newBattleInstance);

    await this.guildBossService.consumeEntries({ guildId: prepared.guildId, emails: prepared.emails });

    newBattleInstance.notifyUsers();
    this.battleList.push(newBattleInstance);
    return true;
  }

  /**
   * Walking into a dungeon. The entry is spent here, before the first blow: an
   * attempt is what the day buys, and it is the whole party's day — one member
   * out of entries keeps everyone out.
   */
  async createDungeonBattle(args: { userEmail: string; dungeonId: number }) {
    const battle = this.getUserBattle(args.userEmail);
    if (battle) {
      battle.notifyUsers();
      return true;
    }

    const { users, partyLeaderEmail } = await this._gatherParty(args.userEmail);

    // Checked before the entry is spent rather than by the battle validator
    // after it: someone left on the floor by an earlier fight would otherwise
    // cost the party the day and give them a raw exception for it.
    const fallen = users.find((user) => (user.stats?.health ?? 0) <= 0);
    if (fallen) {
      const who = fallen.email === args.userEmail ? 'You have' : `${fallen.name} has`;
      this.socket.sendErrorNotification({
        email: args.userEmail,
        text: `${who} to recover before the party can go in`,
      });
      return false;
    }

    const prepared = await this.dungeonService.prepareEntry({
      userEmail: args.userEmail,
      participants: users.map((user) => ({ email: user.email, name: user.name })),
      dungeonId: args.dungeonId,
    });
    if (!prepared) return false;

    const run = await this.dungeonService.startRun({
      dungeonId: prepared.dungeon.id,
      leaderEmail: partyLeaderEmail ?? args.userEmail,
      emails: prepared.emails,
    });

    return this._openDungeonFight({
      users,
      boss: prepared.boss,
      runId: run.id,
      dungeonName: prepared.dungeon.name,
      totalStages: prepared.dungeon.monsters.length,
      creatorEmail: args.userEmail,
      partyLeaderEmail,
    });
  }

  /**
   * The next boss in a run already under way. No entry is spent — that was paid
   * on the way in — but the party arrives on whatever health the last fight
   * left them, topped up only to the camp share.
   */
  async continueDungeonRun(args: { userEmail: string }) {
    const battle = this.getUserBattle(args.userEmail);
    if (battle && !battle.battleFinished) {
      this.socket.sendErrorNotification({
        email: args.userEmail,
        text: 'Finish the fight you are in first',
      });
      return false;
    }

    const prepared = await this.dungeonService.prepareNextFight({ userEmail: args.userEmail });
    if (!prepared) return false;

    // The finished fight goes before the new one is built, so the party is
    // never in two battles at once.
    if (battle) {
      await battle.removeBattle();
      battle.notifyBattleRemoved();
    }

    await this.dungeonService.campRestoreForRun({ emails: prepared.emails });
    // Read after the camp, so the party stands up on the health it restored.
    const users = await this._loadUsers(prepared.emails);

    return this._openDungeonFight({
      users,
      boss: prepared.boss,
      runId: prepared.run.id,
      dungeonName: prepared.run.dungeon.name,
      totalStages: prepared.run.dungeon.monsters.length,
      creatorEmail: args.userEmail,
      partyLeaderEmail: prepared.run.leaderEmail,
    });
  }

  private async _openDungeonFight(args: {
    users: UserWithStats[];
    boss: DungeonMonsterWithDrops;
    runId: number;
    dungeonName: string;
    totalStages: number;
    creatorEmail: string;
    partyLeaderEmail?: string;
  }) {
    const newBattleInstance = new BattleInstance({
      socket: this.socket,
      users: args.users,
      monsters: [toBattleMonster(args.boss)],
      updateUsers: (b) => this.updateStatsAndRewards(b),
      removeBattle: () => this._remove(args.creatorEmail),
      dungeon: {
        runId: args.runId,
        name: args.dungeonName,
        stage: args.boss.stage,
        totalStages: args.totalStages,
      },
      enrageAfterRound: DUNGEON_ENRAGE_ROUND,
      partyLeaderEmail: args.partyLeaderEmail,
    });
    BattleValidations.validateBattleInstanceStart(newBattleInstance);

    newBattleInstance.notifyUsers();
    this.battleList.push(newBattleInstance);
    return true;
  }

  /** The caller and whoever they are partied with, plus who leads them. */
  private async _gatherParty(userEmail: string) {
    const userData = await this.usersRepository.getFullUser({ userEmail });
    if (!userData.partyId) return { users: [userData] as UserWithStats[], partyLeaderEmail: undefined };

    const fullPartyInfo = await this.partyRepository.getPartyFromId({ partyId: userData.partyId });
    return { users: fullPartyInfo.members as UserWithStats[], partyLeaderEmail: fullPartyInfo.leaderEmail };
  }

  /** The run's own members, which is not the same list as the current party. */
  private async _loadUsers(emails: string[]) {
    const users: UserWithStats[] = [];
    for await (const userEmail of emails) {
      const user = await this.usersRepository.getFullUser({ userEmail });
      if (user) users.push(user);
    }
    return users;
  }

  /**
   * Running from a fight ends it for the whole party, so it is not everyone's
   * call: the leader may do it at any point, anyone else only on their own
   * turn. A solo fight or a finished one is nobody else's business.
   */
  async finishBattle(args: { userEmail: string }) {
    const battle = this.getUserBattle(args.userEmail);
    if (!battle) return false;

    if (!(await this._canEndBattle({ battle, userEmail: args.userEmail }))) {
      this.socket.sendErrorNotification({
        email: args.userEmail,
        text: 'Only the party leader can run outside their turn',
      });
      return false;
    }

    // Running from the boss, or being wiped by it, still counts: the damage was
    // dealt and the entry was spent either way.
    await this._bankGuildBossDamage(battle);
    await this._closeDungeonRun(battle);
    battle.removeBattle();
    battle.notifyBattleRemoved();
    return true;
  }

  /**
   * Leaving a dungeon fight ends the run, whichever way it is left — wiped,
   * run from, or simply walked out of after a boss went down. The entry paid
   * for an attempt, and this is where the attempt stops.
   *
   * A run the party has already cleared is untouched: failRun only acts on one
   * that is still standing.
   */
  private async _closeDungeonRun(battle: BattleInstance) {
    if (!battle.dungeon) return;
    await this.dungeonService.failRun({ runId: battle.dungeon.runId });
  }

  /** No-op for a normal fight; consumeDamage empties itself so it cannot double up. */
  private async _bankGuildBossDamage(battle: BattleInstance) {
    if (!battle.guildBossGuildId) return;

    await this.guildBossService.applyDamage({
      guildId: battle.guildBossGuildId,
      damageByUser: battle.consumeDamage(),
      participants: battle.participantEmails,
      partyLeaderEmail: battle.partyLeaderEmail,
    });
  }

  private async _canEndBattle(args: { battle: BattleInstance; userEmail: string }) {
    if (args.battle.battleFinished || args.battle.isSolo) return true;

    const user = await this.prisma.user.findUnique({
      where: { email: args.userEmail },
      include: { Party: true },
    });
    if (!user) return false;
    if (user.Party?.leaderEmail === args.userEmail) return true;

    return args.battle.currentTurnName === user.name;
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
  /**
   * Drinking a potion in the middle of a fight — Alchemy's whole reason to
   * exist. Only items flagged `battleUse` qualify: food is a thing you eat
   * beforehand, and letting it be eaten mid-fight would make the cook a worse
   * alchemist rather than a different profession.
   *
   * The turn is checked before the stack is taken, so a mistimed click costs
   * nothing, and the inventory write lands before the battle applies the effect
   * so a crash cannot leave the drink both spent and unspent.
   */
  async useItem(args: { userEmail: string; inventoryId: number }) {
    const battle = this.getUserBattle(args.userEmail);
    if (!battle) return false;
    if (battle.battleFinished) return false;
    if (!battle.isTurnOf(args.userEmail)) {
      this.socket.sendErrorNotification({ email: args.userEmail, text: 'Wait for your turn' });
      return false;
    }

    const inventoryItem = await this.inventory.getOneInventoryItem({
      userEmail: args.userEmail,
      inventoryId: args.inventoryId,
    });
    if (!inventoryItem || inventoryItem.item.category !== 'consumable') return false;
    if (!inventoryItem.item.battleUse) {
      this.socket.sendErrorNotification({
        email: args.userEmail,
        text: `${inventoryItem.item.name} cannot be used in a fight`,
      });
      return false;
    }

    const { item, quality } = inventoryItem;
    await this.inventory.removeItemFromInventory({
      userEmail: args.userEmail,
      inventoryId: args.inventoryId,
      stack: 1,
    });

    // Escape Powder buys its way past the party-leader rule: anyone holding one
    // can call the retreat, which is the point of carrying it.
    if (item.battleEffect === 'escape') {
      await this._bankGuildBossDamage(battle);
      await this._closeDungeonRun(battle);
      battle.pushLog({ icon: item.image, log: `${item.name} filled the air — the party slipped away` });
      battle.removeBattle();
      battle.notifyBattleRemoved();
      await this.userService.notifyUserUpdateWithProfile({ email: args.userEmail });
      return true;
    }

    await battle.processUserConsume({
      email: args.userEmail,
      itemName: item.name,
      image: item.image,
      health: consumablePotency({ base: item.health, quality }),
      mana: consumablePotency({ base: item.mana, quality }),
      buff: item.buff ?? undefined,
      buffDuration: item.buff ? buffDurationForQuality({ duration: item.buff.duration, quality }) : undefined,
    });

    await this.userService.notifyUserUpdateWithProfile({ email: args.userEmail });
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
      // The database is remote, so a dozen sequential writes can outrun the
      // default five second interactive budget.
      let contributedGuildId: number | null = null;
      await this.prisma.$transaction(async (tx) => {
        await this.userStats.decreaseUserBuffs({ userEmail, tx });
        await this.userWallet.addExpSilver({ userEmail, silver, exp, tx });
        await this.userStats.levelUpUser({
          user: rewardUser,
          expGain: exp,
          tx,
        });
        await this.userStats.updateUserHealthMana({
          userEmail,
          health: remainingHealth,
          mana: remainingMana,
          tx,
        });
        contributedGuildId = await this.guildTaskService.contributeToGuildTask({
          userEmail,
          mapId,
          amount: monsterCount,
          tx,
        });

        for await (const { itemId, stack } of dropedItems) {
          await this.inventory.addItemToInventory({
            userEmail,
            itemId,
            stack,
            quality: 1,
            enhancement: 0,
            tx,
          });
        }
      }, TRANSACTION_OPTIONS);

      // Both re-read and push, so they wait until the rewards are committed.
      if (contributedGuildId) {
        await this.guildTaskService.refreshGuild(contributedGuildId);
      }
      await this.userService.notifyUserUpdateWithProfile({ email: userEmail });
    }

    // Last, so the kill payout lands after everyone's own rewards are committed.
    await this._bankGuildBossDamage(battle);

    // The boss is down, so the run moves on — and closes itself if that was the
    // last of them. Everything the fight was worth is already banked above.
    if (battle.dungeon) {
      await this.dungeonService.completeStage({ runId: battle.dungeon.runId });
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
