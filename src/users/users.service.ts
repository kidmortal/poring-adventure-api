import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { prisma } from 'src/prisma/prisma';

@Injectable()
export class UsersService {
  async create(createUserDto: CreateUserDto) {
    await prisma.user.create({
      data: {
        name: createUserDto.name,
        classname: createUserDto.classname,
        email: createUserDto.email,
      },
    });
    await prisma.appearance.create({
      data: {
        userEmail: createUserDto.email,
        costume: createUserDto.classname,
        gender: createUserDto.gender,
        head: 'head_1',
      },
    });
    const fullUser = await prisma.user.findUnique({
      where: { email: createUserDto.email },
      include: {
        appearance: true,
      },
    });
    return fullUser;
  }

  async dumpMockUsers() {
    const createdUsers: any = [];
    for (let index = 0; index < 200; index++) {
      try {
        const created = await prisma.user.create({
          data: {
            name: `Dump ${index}`,
            classname: 'none',
            email: `dump${index}@test.com`,
            experience: 1,
            level: 1,
          },
        });

        createdUsers.push(created);
      } catch (error) {}
    }
    return createdUsers;
  }

  findAll() {
    return prisma.user.findMany({
      take: 10,
      orderBy: {
        level: 'desc',
      },
      include: {
        appearance: true,
      },
    });
  }

  async findOne(email: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        appearance: true,
        inventory: { include: { item: true, marketListing: true } },
        equipment: { include: { item: true } },
      },
    });

    return user;
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    console.log(updateUserDto);
    return `This action updates a #${id} user`;
  }

  async remove(email: string) {
    const deletedUser = await prisma.user.delete({
      where: { email },
      include: {
        appearance: true,
      },
    });
    return deletedUser;
  }

  async addSilverToUser(args: { userEmail: string; amount: number }) {
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

  async removeSilverFromUser(args: { userEmail: string; amount: number }) {
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

  wipeDatabase() {
    return prisma.user.deleteMany({});
  }
}
