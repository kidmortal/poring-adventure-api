import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { prisma } from 'src/prisma/prisma';

@Injectable()
export class UsersService {
  create(createUserDto: CreateUserDto) {
    return prisma.user.create({
      data: createUserDto,
    });
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
            strength: 1,
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
    prisma.user.update({
      where: {
        email: 'amanda@algo',
      },
      data: {
        name: 'amanda',
      },
    });
    return prisma.user.findMany({});
  }

  findOne(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    console.log(updateUserDto);
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }

  wipeDatabase() {
    return prisma.user.deleteMany({});
  }
}
