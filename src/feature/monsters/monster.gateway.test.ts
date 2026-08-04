import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { MonstersService } from './monsters.service';
import { MonsterGateway } from './monsters.gateway';
import { CacheModule } from '@nestjs/cache-manager';

describe('Party Gateway', () => {
  let service: MonstersService;
  let gateway: MonsterGateway;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [CacheModule.register({ ttl: 1000 * 60 * 10 })],
      providers: [MonsterGateway, MonstersService, PrismaService, WebsocketService],
    }).compile();

    service = module.get<MonstersService>(MonstersService);
    gateway = module.get<MonsterGateway>(MonsterGateway);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('get_monster_from_map', () => {
    it('should call findOneFromMap service', async () => {
      const mapId = 0;
      const fakeReturn = {} as any;
      const findOneFromMap = jest.fn().mockReturnValue(fakeReturn);
      jest.spyOn(service, 'findOneFromMap').mockImplementation(findOneFromMap);
      const response = await gateway.getMonsterFromMap(mapId);
      expect(findOneFromMap).toHaveBeenCalledWith(mapId);
      expect(response).toBe(fakeReturn);
    });
  });
  describe('findAllFromMap', () => {
    it('should only query the map it was given', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      jest.spyOn(prisma.monster, 'findMany').mockImplementation(findMany);

      await service.findAllFromMap(3);

      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { mapId: 3 } }));
    });

    it('should return nothing rather than query every map when the id is missing', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      jest.spyOn(prisma.monster, 'findMany').mockImplementation(findMany);

      const monsters = await service.findAllFromMap(undefined as unknown as number);

      // Prisma would ignore an undefined filter and hand back the whole table.
      expect(findMany).not.toHaveBeenCalled();
      expect(monsters).toEqual([]);
    });
  });
  describe('findPullFromMap', () => {
    const poring = { id: 1, name: 'Poring', boss: false, health: 10, drops: [] } as any;
    const drops = { id: 2, name: 'Drops', boss: false, health: 10, drops: [] } as any;
    const kades = { id: 3, name: 'Kades', boss: true, health: 500, drops: [] } as any;

    function stubMap(monsters: any[]) {
      jest.spyOn(service, 'findAllFromMap').mockResolvedValue(monsters);
    }

    it('brings a pack of ordinary monsters, never more than the ceiling', async () => {
      stubMap([poring, drops]);

      for (let attempt = 0; attempt < 50; attempt++) {
        const pull = await service.findPullFromMap({ mapId: 1, maxSize: 3 });
        expect(pull.length).toBeGreaterThanOrEqual(1);
        expect(pull.length).toBeLessThanOrEqual(3);
      }
    });

    it('leaves a boss to be fought alone', async () => {
      stubMap([kades]);

      const pull = await service.findPullFromMap({ mapId: 1, maxSize: 3 });
      expect(pull).toHaveLength(1);
      expect(pull[0].name).toBe('Kades');
    });

    it('never puts a boss in a pack it did not lead', async () => {
      stubMap([poring, kades]);

      for (let attempt = 0; attempt < 50; attempt++) {
        const pull = await service.findPullFromMap({ mapId: 1, maxSize: 3 });
        if (pull.length > 1) expect(pull.some((monster) => monster.boss)).toBe(false);
      }
    });

    it('names duplicates apart, since the turn order addresses a monster by name', async () => {
      stubMap([poring]);

      for (let attempt = 0; attempt < 20; attempt++) {
        const pull = await service.findPullFromMap({ mapId: 1, maxSize: 3 });
        const names = pull.map((monster) => monster.name);
        expect(new Set(names).size).toBe(names.length);
        if (names.length > 1) expect(names[0]).toBe('Poring A');
      }
    });

    it('hands out copies, so one monster taking damage is not both of them', async () => {
      stubMap([poring]);
      const pull = await service.findPullFromMap({ mapId: 1, maxSize: 1 });

      pull[0].health -= 5;
      expect(poring.health).toBe(10);
    });

    it('has nothing to fight on an empty map', async () => {
      stubMap([]);
      expect(await service.findPullFromMap({ mapId: 99, maxSize: 3 })).toEqual([]);
    });
  });

  describe('get_maps', () => {
    it('should call getAllMaps service ', async () => {
      const fakeReturn = {} as any;
      const getAllMaps = jest.fn().mockReturnValue(fakeReturn);
      jest.spyOn(service, 'getAllMaps').mockImplementation(getAllMaps);
      const response = await gateway.getMaps();
      expect(getAllMaps).toHaveBeenCalledWith();
      expect(response).toBe(fakeReturn);
    });
  });
});
