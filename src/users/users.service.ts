import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { WebsocketService } from 'src/websocket/websocket.service';
import { UserWithStats } from 'src/battle/battle';
import { utils } from 'src/utils';
import { PrismaService } from 'src/prisma/prisma.service';
import { TransactionContext } from 'src/prisma/types/prisma';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class UsersService {
  constructor(
    private readonly websocket: WebsocketService,
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}
  private cacheLogger = new Logger('Cache - Users');
  async notifyUserUpdate(args: { email: string; payload: any }) {
    return this.websocket.sendMessageToSocket({
      email: args.email,
      event: 'user_update',
      payload: args.payload,
    });
  }

  async notifyUserUpdateWithProfile(args: { email: string }) {
    this.clearUserCache(args);
    const user = await this._getUserWithEmail({ userEmail: args.email });

    if (user) {
      this.websocket.sendMessageToSocket({
        email: args.email,
        event: 'user_update',
        payload: user,
      });
      return true;
    }
    return false;
  }

  async create(createUserDto: CreateUserDto) {
    const newUser = await this.prisma.user.create({
      data: {
        name: createUserDto.name,
        email: createUserDto.email,
        appearance: {
          create: {
            costume: createUserDto.costume,
            gender: createUserDto.gender,
            head: '1',
          },
        },
        stats: {
          create: { experience: 1 },
        },
        professionId: createUserDto.professionId,
      },
    });
    return newUser;
  }

  async findAll(params: { page: number }) {
    const cacheKey = `user_ranking_${params.page}`;
    const cachecRanking = await this.cache.get(cacheKey);
    if (cachecRanking) {
      this.cacheLogger.log(`returning cached ${cacheKey}`);
      return cachecRanking as any;
    }
    const ranking = await this.prisma.user.findMany({
      skip: (params.page - 1) * 10,
      take: 10,
      orderBy: { stats: { experience: 'desc' } },
      include: { appearance: true, stats: true },
    });
    this.cache.set(cacheKey, ranking);

    return ranking;
  }

  getAllProfessions() {
    return this.prisma.profession.findMany({
      include: {
        skills: true,
      },
    });
  }

  getAllHeads() {
    return this.prisma.head.findMany({});
  }

  async updateUserName(args: { email: string; newName: string }) {
    await this.prisma.user.update({
      where: { email: args.email },
      data: { name: args.newName },
    });
    return true;
  }

  async findOne(args: { userEmail: string }) {
    await this.notifyUserUpdateWithProfile({ email: args.userEmail });

    return true;
  }

  async isAdmin(email: string) {
    const cacheKey = `user_admin_info_${email}`;
    const cachedUser = await this.cache.get(cacheKey);
    if (cachedUser) {
      this.cacheLogger.log(`returning cached ${cacheKey}`);
      return cachedUser as any;
    }
    if (!email) {
      throw new BadRequestException('No email provided');
    }
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    this.cache.set(cacheKey, user);
    return user.admin;
  }

  async updateUserHealthMana(args: {
    userEmail: string;
    health: number;
    mana: number;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;
    await tx.stats.update({
      where: {
        userEmail: args.userEmail,
      },
      data: {
        health: args.health,
        mana: args.mana,
      },
    });
    this.clearUserCache({ email: args.userEmail });
    return true;
  }

  async decrementUserHealth(args: { userEmail: string; amount: number }) {
    const currentStats = await this.prisma.stats.findUnique({
      where: {
        userEmail: args.userEmail,
      },
    });

    if (currentStats) {
      const currentHealth = currentStats.health;
      let finalHealth = currentHealth - args.amount;
      if (finalHealth < 0) {
        finalHealth = 0;
      }
      return this.prisma.stats.update({
        where: {
          userEmail: args.userEmail,
        },
        data: {
          health: {
            set: finalHealth,
          },
        },
      });
    }
  }

  async incrementUserHealth(args: {
    userEmail: string;
    amount: number;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;
    const currentStats = await tx.stats.findUnique({
      where: {
        userEmail: args.userEmail,
      },
    });

    if (currentStats) {
      const maxHealth = currentStats.maxHealth;
      const currentHealth = currentStats.health;
      let finalHealth = currentHealth + args.amount;
      if (finalHealth > maxHealth) {
        finalHealth = maxHealth;
      }
      await tx.stats.update({
        where: { userEmail: args.userEmail },
        data: { health: { set: finalHealth } },
      });
      this.clearUserCache({ email: args.userEmail });

      return true;
    }
  }

  async decrementUserMana(args: { userEmail: string; amount: number }) {
    const currentStats = await this.prisma.stats.findUnique({
      where: {
        userEmail: args.userEmail,
      },
    });

    if (currentStats) {
      const currentMana = currentStats.mana;
      let finalMana = currentMana - args.amount;
      if (finalMana < 0) {
        finalMana = 0;
      }
      await this.prisma.stats.update({
        where: {
          userEmail: args.userEmail,
        },
        data: {
          mana: {
            set: finalMana,
          },
        },
      });
      this.clearUserCache({ email: args.userEmail });
      return true;
    }
  }

  async incrementUserMana(args: {
    userEmail: string;
    amount: number;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;
    const currentStats = await tx.stats.findUnique({
      where: {
        userEmail: args.userEmail,
      },
    });

    if (currentStats) {
      const maxMana = currentStats.maxMana;
      const currentMana = currentStats.mana;
      let finalMana = currentMana + args.amount;
      if (finalMana > maxMana) {
        finalMana = maxMana;
      }
      await tx.stats.update({
        where: {
          userEmail: args.userEmail,
        },
        data: {
          mana: {
            set: finalMana,
          },
        },
      });
      this.clearUserCache({ email: args.userEmail });
      return true;
    }
  }

  async increaseUserStats(args: {
    userEmail: string;
    level?: number;
    health?: number;
    mana?: number;
    attack?: number;
    str?: number;
    int?: number;
    agi?: number;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;
    await tx.stats.update({
      where: {
        userEmail: args.userEmail,
      },
      data: {
        level: { increment: args.level ?? 0 },
        maxHealth: { increment: args.health ?? 0 },
        maxMana: { increment: args.mana ?? 0 },
        attack: { increment: args.attack ?? 0 },
        str: { increment: args.str ?? 0 },
        agi: { increment: args.agi ?? 0 },
        int: { increment: args.int ?? 0 },
      },
    });
    this.clearUserCache({ email: args.userEmail });
    return true;
  }
  async decreaseUserStats(args: {
    userEmail: string;
    level?: number;
    health?: number;
    mana?: number;
    attack?: number;
    str?: number;
    int?: number;
    agi?: number;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;
    await tx.stats.update({
      where: {
        userEmail: args.userEmail,
      },
      data: {
        level: { decrement: args.level ?? 0 },
        maxHealth: { decrement: args.health ?? 0 },
        maxMana: { decrement: args.mana ?? 0 },
        attack: { decrement: args.attack ?? 0 },
        str: { decrement: args.str ?? 0 },
        agi: { decrement: args.agi ?? 0 },
        int: { decrement: args.int ?? 0 },
      },
    });
    this.clearUserCache({ email: args.userEmail });
    return true;
  }

  async deleteUser(email: string) {
    const deletedUser = await this.prisma.user.delete({
      where: { email },
    });
    return deletedUser;
  }
  async addExpSilver(args: {
    userEmail: string;
    exp: number;
    silver: number;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;
    await tx.user.update({
      where: {
        email: args.userEmail,
      },
      data: {
        silver: { increment: args.silver },
        stats: { update: { experience: { increment: args.exp } } },
      },
    });
    this.clearUserCache({ email: args.userEmail });
    return true;
  }
  async addSilverToUser(args: {
    userEmail: string;
    amount: number;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;
    await tx.user.update({
      where: {
        email: args.userEmail,
      },
      data: {
        silver: {
          increment: args.amount,
        },
      },
    });
    this.clearUserCache({ email: args.userEmail });
    return true;
  }
  async addExpToUser(args: {
    userEmail: string;
    amount: number;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;
    await tx.stats.update({
      where: {
        userEmail: args.userEmail,
      },
      data: {
        experience: {
          increment: args.amount,
        },
      },
    });
    this.clearUserCache({ email: args.userEmail });
    return true;
  }

  async removeSilverFromUser(args: {
    userEmail: string;
    amount: number;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;
    await tx.user.update({
      where: {
        email: args.userEmail,
      },
      data: {
        silver: {
          decrement: args.amount,
        },
      },
    });
    this.clearUserCache({ email: args.userEmail });
    return true;
  }

  async transferSilverFromUserToUser(args: {
    senderEmail: string;
    receiverEmail: string;
    amount: number;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;
    await this.removeSilverFromUser({
      userEmail: args.senderEmail,
      amount: args.amount,
      tx,
    });
    return await this.addSilverToUser({
      userEmail: args.receiverEmail,
      amount: args.amount,
      tx,
    });
  }

  async increaseUserLevel(args: {
    userEmail: string;
    amount: number;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;
    const increaseAmount = args.amount;
    const user = await tx.user.findUnique({
      where: { email: args.userEmail },
      include: { profession: true },
    });
    const profession = user.profession;
    const healthIncrease = profession.health * increaseAmount;
    const manaIncrease = profession.mana * increaseAmount;
    const attackIncrease = profession.attack * increaseAmount;
    const strIncrease = profession.str * increaseAmount;
    const agiIncrease = profession.agi * increaseAmount;
    const intIncrease = profession.int * increaseAmount;
    await this.increaseUserStats({
      userEmail: args.userEmail,
      attack: attackIncrease,
      level: increaseAmount,
      health: healthIncrease,
      mana: manaIncrease,
      str: strIncrease,
      agi: agiIncrease,
      int: intIncrease,
      tx,
    });
  }

  async decreaseUserLevel(args: {
    userEmail: string;
    amount: number;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;
    const decreaseAmount = args.amount;
    const user = await tx.user.findUnique({
      where: { email: args.userEmail },
      include: { profession: true },
    });
    const profession = user.profession;
    const healthDecrease = profession.health * decreaseAmount;
    const manaDecrease = profession.mana * decreaseAmount;
    const attackDecrease = profession.attack * decreaseAmount;
    const strDecrease = profession.str * decreaseAmount;
    const agiDecrease = profession.agi * decreaseAmount;
    const intDecrease = profession.int * decreaseAmount;
    await this.decreaseUserStats({
      userEmail: args.userEmail,
      level: decreaseAmount,
      health: healthDecrease,
      mana: manaDecrease,
      attack: attackDecrease,
      str: strDecrease,
      agi: agiDecrease,
      int: intDecrease,
      tx,
    });
  }

  async decreaseUserBuffs(args: {
    userEmail: string;
    tx?: TransactionContext;
  }) {
    const tx = args.tx ?? this.prisma;
    await tx.userBuff.updateMany({
      where: { userEmail: args.userEmail },
      data: { duration: { decrement: 1 } },
    });
    await tx.userBuff.deleteMany({
      where: { userEmail: args.userEmail, duration: { lte: 0 } },
    });
    return true;
  }

  async levelUpUser({
    user,
    expGain,
    ...args
  }: {
    user: UserWithStats;
    expGain: number;
    tx?: TransactionContext;
  }) {
    const tx = args.tx ?? this.prisma;
    const currentExp = user.stats.experience;
    const finalExp = currentExp + expGain;
    const currentLevel = user.stats.level;
    const correctLevel = utils.getLevelFromExp(finalExp);
    if (correctLevel > currentLevel) {
      const levelDiff = correctLevel - currentLevel;
      await this.increaseUserLevel({
        userEmail: user.email,
        amount: levelDiff,
        tx,
      });
      return true;
    }
    if (currentLevel > correctLevel) {
      const levelDiff = currentLevel - correctLevel;
      await this.decreaseUserLevel({
        userEmail: user.email,
        amount: levelDiff,
        tx,
      });
      return true;
    }
    return false;
  }

  async revalidateUsers() {
    const invalidUsers = await this.prisma.user.findMany({
      where: {
        stats: null,
      },
    });
    for await (const user of invalidUsers) {
      await this.prisma.stats.create({
        data: {
          userEmail: user.email,
        },
      });
    }
  }

  async clearUserCache(args: { email: string }) {
    const cacheKey = `user_${args.email}`;
    this.cacheLogger.debug(`clearing ${cacheKey}`);
    this.cache.del(cacheKey);
  }

  async _getUserWithEmail(args: { userEmail: string }) {
    if (!args.userEmail) {
      throw new BadRequestException('No email provided');
    }
    const cacheKey = `user_${args.userEmail}`;
    const cachedUser = await this.cache.get(cacheKey);
    if (cachedUser) {
      this.cacheLogger.log(`returning cached ${cacheKey}`);
      return cachedUser as any;
    }
    const user = await this.prisma.user.findUnique({
      where: { email: args.userEmail },
      include: {
        appearance: true,
        inventory: { include: { item: true, marketListing: true } },
        equipment: { include: { item: true } },
        profession: { include: { skills: true } },
        learnedSkills: { include: { skill: { include: { buff: true } } } },
        buffs: { include: { buff: true } },
        guildMember: true,
        stats: true,
      },
    });
    this.cache.set(cacheKey, user);

    return user;
  }
}
