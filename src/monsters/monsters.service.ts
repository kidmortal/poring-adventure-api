import { Injectable } from '@nestjs/common';

import { prisma } from 'src/prisma/prisma';

@Injectable()
export class MonstersService {
  findAll() {
    return prisma.monster.findMany({
      include: {
        drops: {
          include: {
            item: true,
          },
        },
      },
    });
  }

  async findOne() {
    const monsterCount = await prisma.monster.count();
    const skip = Math.floor(Math.random() * monsterCount);
    return prisma.monster.findFirst({
      skip,
      include: {
        drops: {
          include: {
            item: true,
          },
        },
      },
    });
  }

  remove(id: number) {
    return `This action removes a #${id} monster`;
  }
}
