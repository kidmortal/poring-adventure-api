import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { WebsocketService } from 'src/websocket/websocket.service';
import { UserWithStats } from 'src/battle/battle';
import { utils } from 'src/utils';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly websocket: WebsocketService,
    private readonly prisma: PrismaService,
  ) {}
  async notifyUserUpdate(args: { email: string; payload: any }) {
    return this.websocket.sendMessageToSocket({
      email: args.email,
      event: 'user_update',
      payload: args.payload,
    });
  }

  async notifyUserError(args: { email: string; errorMessage: any }) {
    return this.websocket.sendMessageToSocket({
      email: args.email,
      event: 'error_notification',
      payload: args.errorMessage,
    });
  }

  async notifyUserUpdateWithProfile(args: { email: string }) {
    const user = await this.findOne(args.email);

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

  findAll() {
    return this.prisma.user.findMany({
      take: 20,
      orderBy: {
        stats: {
          experience: 'desc',
        },
      },
      include: {
        appearance: true,
        stats: true,
      },
    });
  }

  getAllProfessions() {
    return this.prisma.profession.findMany({
      include: {
        skills: true,
      },
    });
  }

  async findOne(email: string) {
    if (!email) {
      throw new BadRequestException('No email provided');
    }
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        appearance: true,
        inventory: { include: { item: true, marketListing: true } },
        equipment: { include: { item: true } },
        profession: { include: { skills: true } },
        learnedSkills: { include: { skill: true } },
        buffs: { include: { buff: true } },
        stats: true,
      },
    });

    return user;
  }

  async isAdmin(email: string) {
    if (!email) {
      throw new BadRequestException('No email provided');
    }
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    return user.admin;
  }

  async updateUserHealthMana(args: {
    userEmail: string;
    health: number;
    mana: number;
  }) {
    return this.prisma.stats.update({
      where: {
        userEmail: args.userEmail,
      },
      data: {
        health: args.health,
        mana: args.mana,
      },
    });
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

  async incrementUserHealth(args: { userEmail: string; amount: number }) {
    const currentStats = await this.prisma.stats.findUnique({
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
      return this.prisma.stats.update({
        where: {
          userEmail: args.userEmail,
        },
        data: {
          mana: {
            set: finalMana,
          },
        },
      });
    }
  }

  async incrementUserMana(args: { userEmail: string; amount: number }) {
    const currentStats = await this.prisma.stats.findUnique({
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
      return this.prisma.stats.update({
        where: {
          userEmail: args.userEmail,
        },
        data: {
          mana: {
            set: finalMana,
          },
        },
      });
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
  }) {
    return this.prisma.stats.update({
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
  }) {
    return this.prisma.stats.update({
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
  }

  async deleteUser(email: string) {
    const deletedUser = await this.prisma.user.delete({
      where: { email },
    });
    return deletedUser;
  }
  async addExpSilver(args: { userEmail: string; exp: number; silver: number }) {
    return this.prisma.user.update({
      where: {
        email: args.userEmail,
      },
      data: {
        silver: { increment: args.silver },
        stats: { update: { experience: { increment: args.exp } } },
      },
    });
  }
  async addSilverToUser(args: { userEmail: string; amount: number }) {
    return this.prisma.user.update({
      where: {
        email: args.userEmail,
      },
      data: {
        silver: {
          increment: args.amount,
        },
      },
    });
  }
  async addExpToUser(args: { userEmail: string; amount: number }) {
    return this.prisma.stats.update({
      where: {
        userEmail: args.userEmail,
      },
      data: {
        experience: {
          increment: args.amount,
        },
      },
    });
  }

  async removeSilverFromUser(args: { userEmail: string; amount: number }) {
    return this.prisma.user.update({
      where: {
        email: args.userEmail,
      },
      data: {
        silver: {
          decrement: args.amount,
        },
      },
    });
  }

  async transferSilverFromUserToUser(args: {
    senderEmail: string;
    receiverEmail: string;
    amount: number;
  }) {
    await this.removeSilverFromUser({
      userEmail: args.senderEmail,
      amount: args.amount,
    });
    return await this.addSilverToUser({
      userEmail: args.receiverEmail,
      amount: args.amount,
    });
  }

  async increaseUserLevel(args: { userEmail: string; amount: number }) {
    const increaseAmount = args.amount;
    const user = await this.prisma.user.findUnique({
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
    });
  }

  async decreaseUserLevel(args: { userEmail: string; amount: number }) {
    const decreaseAmount = args.amount;
    const user = await this.prisma.user.findUnique({
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
    });
  }

  async decreaseUserBuffs(args: { userEmail: string }) {
    await this.prisma.userBuff.updateMany({
      where: { userEmail: args.userEmail },
      data: { duration: { decrement: 1 } },
    });
    await this.prisma.userBuff.deleteMany({
      where: { userEmail: args.userEmail, duration: { lte: 0 } },
    });
    return true;
  }

  async levelUpUser({
    user,
    expGain,
  }: {
    user: UserWithStats;
    expGain: number;
  }) {
    const currentExp = user.stats.experience;
    const finalExp = currentExp + expGain;
    const currentLevel = user.stats.level;
    const correctLevel = utils.getLevelFromExp(finalExp);
    if (correctLevel > currentLevel) {
      const levelDiff = correctLevel - currentLevel;
      await this.increaseUserLevel({
        userEmail: user.email,
        amount: levelDiff,
      });
      return true;
    }
    if (currentLevel > correctLevel) {
      const levelDiff = currentLevel - correctLevel;
      console.log(levelDiff);
      await this.decreaseUserLevel({
        userEmail: user.email,
        amount: levelDiff,
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
}
