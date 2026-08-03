import { UsersRepository } from 'src/feature/users/users.repository';
import { UserWalletService } from 'src/feature/users/userWallet.service';
import { UserStatsService } from 'src/feature/users/userStats.service';
import { Injectable, Logger } from '@nestjs/common';

import { BattleInstance, UserWithStats } from './battle';
import { MonstersService } from 'src/feature/monsters/monsters.service';
import { UsersService } from 'src/feature/users/users.service';
import { InventoryService } from 'src/feature/items/inventory.service';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { Cron } from '@nestjs/schedule';
import { PartyService } from 'src/feature/party/party.service';
import { PartyRepository } from 'src/feature/party/party.repository';
import { BattleValidations } from './validators';
import { GuildService } from 'src/feature/guild/guild.service';
import { GuildTaskService } from 'src/feature/guild/guildTask.service';
import { GuildBossService } from 'src/feature/guild/guildBoss.service';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { TRANSACTION_OPTIONS } from 'src/core/prisma/types/prisma';

/**
 * The guild boss carries a pool far too big for one party, so it turns on them
 * after five rounds rather than letting an unwinnable fight drag on. The damage
 * banked up to that point is kept either way.
 */
const GUILD_BOSS_ENRAGE_ROUND = 5;

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
      const monsterData = await this.monsterService.findOneFromMap(args.mapId);
      // An unknown or empty map has nothing to fight, and a battle built around
      // a missing monster throws deeper in on its first health check.
      if (!monsterData) {
        this.socket.sendErrorNotification({
          email: args.userEmail,
          text: 'There is nothing to fight on that map',
        });
        return false;
      }

      const monsters = [monsterData];
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

    const userData = await this.usersRepository.getFullUser({ userEmail: args.userEmail });
    let users: UserWithStats[] = [userData];
    let partyLeaderEmail: string | undefined;
    if (userData.partyId) {
      const fullPartyInfo = await this.partyRepository.getPartyFromId({ partyId: userData.partyId });
      users = fullPartyInfo.members;
      partyLeaderEmail = fullPartyInfo.leaderEmail;
    }

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
    battle.removeBattle();
    battle.notifyBattleRemoved();
    return true;
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
