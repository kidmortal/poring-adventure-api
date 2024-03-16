import { Injectable } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class MonstersService {
  constructor(private readonly prisma: PrismaService) {}
  findAll() {
    return this.prisma.monster.findMany({
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
    const monsterCount = await this.prisma.monster.count();
    const skip = Math.floor(Math.random() * monsterCount);
    return this.prisma.monster.findFirst({
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
