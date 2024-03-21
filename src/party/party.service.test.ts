import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from 'src/prisma/prisma.service';
import { WebsocketService } from 'src/websocket/websocket.service';
import { PartyGateway } from './party.gateway';
import { PartyService } from './party.service';

describe('Party service', () => {
  let service: PartyService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PartyGateway, PartyService, PrismaService, WebsocketService],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    service = module.get<PartyService>(PartyService);
  });

  describe('createParty', () => {
    it('should call findOne with email when passing email on handshake auth ', async () => {
      const authEmail = 'auth@email.com';
      const fakeParty = {} as any;
      const findFirst = jest.fn().mockResolvedValue(fakeParty);
      prisma.party.findFirst = findFirst;
      service.findOne({ email: authEmail });
      expect(findFirst).toHaveBeenCalled();
    });
  });
});
