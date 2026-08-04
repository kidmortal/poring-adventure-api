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

  /**
   * A pull: what the party actually walks into on a map.
   *
   * A boss is always alone — it is the fight the whole map builds up to, and its
   * numbers are tuned against a party's full attention. Anything else may bring
   * company, drawn from the map's non-boss monsters, so the same map can hand out
   * a lone Poring or a pack of them.
   *
   * Names are made unique, because the turn order, targeting and the client all
   * address a monster by name and two "Poring"s would be one monster taking two
   * turns.
   */
  async findPullFromMap(args: { mapId: number; maxSize: number }) {
    const mapMonsters = await this.findAllFromMap(args.mapId);
    if (mapMonsters.length === 0) return [];

    const lead = mapMonsters[Math.floor(Math.random() * mapMonsters.length)];
    if (lead.boss) return [structuredClone(lead)];

    const company = mapMonsters.filter((monster) => !monster.boss);
    const size = 1 + Math.floor(Math.random() * Math.max(args.maxSize, 1));
    const pull = [lead];
    while (pull.length < size && company.length > 0) {
      pull.push(company[Math.floor(Math.random() * company.length)]);
    }

    return this.nameApart(pull.map((monster) => structuredClone(monster)));
  }

  /** `Poring, Poring` → `Poring A, Poring B`; a monster standing alone keeps its name. */
  private nameApart<T extends { name: string }>(monsters: T[]) {
    const seen: { [name: string]: number } = {};
    monsters.forEach((monster) => (seen[monster.name] = (seen[monster.name] ?? 0) + 1));

    const used: { [name: string]: number } = {};
    return monsters.map((monster) => {
      if (seen[monster.name] <= 1) return monster;
      const index = used[monster.name] ?? 0;
      used[monster.name] = index + 1;
      return { ...monster, name: `${monster.name} ${String.fromCharCode(65 + index)}` };
    });
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
