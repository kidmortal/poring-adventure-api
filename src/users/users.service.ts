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
        level: 1,
        experience: 1,
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
        console.log(created);
        createdUsers.push(created);
      } catch (error) {
        console.log(`Error creating user ${index}`);
      }
    }
    return createdUsers;
  }

  findAll() {
    return prisma.user.findMany({});
  }

  async findOne(email: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { appearance: true },
    });
    console.log(user);
    return user;
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    console.log(updateUserDto);
    return `This action updates a #${id} user`;
  }

  async remove(email: string) {
    const deletedUser = await prisma.user.delete({
      where: { email },
    });
    return deletedUser;
  }

  wipeDatabase() {
    return prisma.user.deleteMany({});
  }
}
