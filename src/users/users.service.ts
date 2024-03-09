import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { prisma } from 'src/prisma/prisma';

@Injectable()
export class UsersService {
  async create(createUserDto: CreateUserDto) {
    const newUser = await prisma.user.create({
      data: {
        name: createUserDto.name,
        classname: createUserDto.classname,
        email: createUserDto.email,
        appearance: {
          create: {
            costume: createUserDto.classname,
            gender: createUserDto.gender,
            head: 'head_1',
          },
        },
        stats: {
          create: { experience: 1 },
        },
      },
    });
    return newUser;
  }

  findAll() {
    return prisma.user.findMany({
      take: 10,
      orderBy: {
        silver: 'desc',
      },
      include: {
        appearance: true,
      },
    });
  }

  async findOne(email: string) {
    if (!email) {
      throw new BadRequestException('No email provided');
    }
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        appearance: true,
        inventory: { include: { item: true, marketListing: true } },
        equipment: { include: { item: true } },
        stats: true,
      },
    });

    return user;
  }

  async isAdmin(email: string) {
    if (!email) {
      throw new BadRequestException('No email provided');
    }
    const user = await prisma.user.findUnique({
      where: { email },
    });

    return user.admin;
  }

  updateUser(id: number, updateUserDto: UpdateUserDto) {
    console.log(updateUserDto);
    return `This action updates a #${id} user`;
  }

  async deleteUser(email: string) {
    const deletedUser = await prisma.user.delete({
      where: { email },
      include: {
        appearance: true,
      },
    });
    return deletedUser;
  }

  private async addSilverToUser(args: { userEmail: string; amount: number }) {
    return prisma.user.update({
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

  private async removeSilverFromUser(args: {
    userEmail: string;
    amount: number;
  }) {
    return prisma.user.update({
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

  async revalidateUsers() {
    const invalidUsers = await prisma.user.findMany({
      where: {
        stats: null,
      },
    });
    for await (const user of invalidUsers) {
      await prisma.stats.create({
        data: {
          userEmail: user.email,
        },
      });
    }
  }
}
