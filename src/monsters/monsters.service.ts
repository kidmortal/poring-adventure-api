import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Cache } from 'cache-manager';

import { PrismaService } from 'src/prisma/prisma.service';

type MapWithMonster = Prisma.MonsterGetPayload<{
  include: { drops: { include: { item: true } } };
}>;

@Injectable()
export class MonstersService {
  constructor(
    @Inject(CACHE_MANAGER) private cache: Cache,
    private readonly prisma: PrismaService,
  ) {}
  async findAllFromMap(mapId: number): Promise<MapWithMonster[]> {
    const cacheKey = `map_monsters_${mapId}`;
    const cachedMap = await this.cache.get(cacheKey);
    if (cachedMap) return cachedMap as any;

    console.log('not cached yet');
    const mapMonsters = await this.prisma.monster.findMany({
      where: { mapId: mapId },
      include: { drops: { include: { item: true } } },
    });
    await this.cache.set(cacheKey, mapMonsters);
    return mapMonsters;
  }

  async findOneFromMap(mapId: number) {
    const mapMonsters = await this.findAllFromMap(mapId);

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
