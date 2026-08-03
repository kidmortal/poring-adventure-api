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
