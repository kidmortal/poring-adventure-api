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

  async findOneFromMap(mapId: number) {
    const mapMonsters = await this.prisma.monster.findMany({
      where: { mapId: mapId },
      include: {
        drops: {
          include: {
            item: true,
          },
        },
      },
    });

    const monsterCount = mapMonsters.length;
    if (monsterCount > 0) {
      const random = Math.floor(Math.random() * monsterCount);
      return mapMonsters[random];
    }
  }

  getAllMaps() {
    return this.prisma.map.findMany({
      include: { monster: true },
    });
  }
}
