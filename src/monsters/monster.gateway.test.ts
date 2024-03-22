import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/prisma/prisma.service';
import { WebsocketService } from 'src/websocket/websocket.service';
import { MonstersService } from './monsters.service';
import { MonsterGateway } from './monsters.gateway';

describe('Party Gateway', () => {
  let service: MonstersService;
  let gateway: MonsterGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonsterGateway,
        MonstersService,
        PrismaService,
        WebsocketService,
      ],
    }).compile();

    service = module.get<MonstersService>(MonstersService);
    gateway = module.get<MonsterGateway>(MonsterGateway);
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
