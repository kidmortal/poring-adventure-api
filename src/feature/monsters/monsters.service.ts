import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Cache } from 'cache-manager';

import { PrismaService } from 'src/core/prisma/prisma.service';
import { ITEM_WITH_BUFF } from 'src/feature/items/entities/itemInclude';

type MapWithMonster = Prisma.MonsterGetPayload<{
  include: { drops: { include: { item: { include: { buff: true } } } } };
}>;

@Injectable()
export class MonstersService {
  constructor(
    @Inject(CACHE_MANAGER) private cache: Cache,
    private readonly prisma: PrismaService,
  ) {}
  async findAllFromMap(mapId: number): Promise<MapWithMonster[]> {
    // Prisma drops an `undefined` filter rather than matching nothing, so a
    // missing map id would otherwise select every monster in the game and the
    // caller would pick one at random from all of them.
    if (!Number.isInteger(mapId)) return [];

    const cacheKey = `map_monsters_${mapId}`;
    const cachedMap = await this.cache.get(cacheKey);
    if (cachedMap) {
      const cloneCacheMap = structuredClone(cachedMap);
      return cloneCacheMap as any;
    }

    console.log('not cached yet');
    const mapMonsters = await this.prisma.monster.findMany({
      where: { mapId: mapId },
      include: { drops: { include: { item: ITEM_WITH_BUFF } } },
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

  async getAllMaps() {
    const cacheKey = `map_monsters`;
    const cachedMap = await this.cache.get(cacheKey);
    if (cachedMap) return cachedMap as any;

    const maps = await this.prisma.map.findMany({
      include: { monster: { include: { drops: { include: { item: ITEM_WITH_BUFF } } } } },
    });
    await this.cache.set(cacheKey, maps);
    return maps;
  }
}
