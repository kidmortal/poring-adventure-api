import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from 'src/prisma/prisma.service';
import { WebsocketService } from 'src/websocket/websocket.service';
import { PartyGateway } from './party.gateway';
import { PartyService } from './party.service';

describe('Party service', () => {
  let service: PartyService;
  let prisma: PrismaService;
  let websocket: WebsocketService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PartyGateway, PartyService, PrismaService, WebsocketService],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    service = module.get<PartyService>(PartyService);
    websocket = module.get<WebsocketService>(WebsocketService);
  });

  describe('findOne', () => {
    it('should call findOne with email and notify entire party ', async () => {
      const authEmail = 'auth@email.com';
      const fakeParty = {
        members: [
          { email: 'fake@fake.com' },
          { email: 'fake@fake.com' },
          { email: 'fake@fake.com' },
        ],
      } as any;
      const findFirst = jest.fn().mockResolvedValue(fakeParty);
      const sendMessageToSocket = jest.fn();
      prisma.party.findFirst = findFirst;
      websocket.sendMessageToSocket = sendMessageToSocket;
      await service.findOne({ email: authEmail });
      expect(findFirst).toHaveBeenCalled();
      expect(sendMessageToSocket).toHaveBeenCalledTimes(
        fakeParty.members.length,
      );
    });
  });
});
