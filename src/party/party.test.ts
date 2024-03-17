import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from 'src/prisma/prisma.service';
import { WebsocketService } from 'src/websocket/websocket.service';
import { PartyGateway } from './party.gateway';
import { PartyService } from './party.service';

describe('User Gateway', () => {
  let service: PartyService;
  let gateway: PartyGateway;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PartyGateway, PartyService, PrismaService, WebsocketService],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    service = module.get<PartyService>(PartyService);
    gateway = module.get<PartyGateway>(PartyGateway);
  });

  describe('get_party', () => {
    it('should notify party with party info when passing email on handshake auth ', async () => {
      const authEmail = 'auth@email.com';
      const notifyPartyWithData = jest.fn().mockReturnValue(true);
      jest
        .spyOn(service, 'notifyPartyWithData')
        .mockImplementation(notifyPartyWithData);
      const returnParty = await gateway.findOne({
        // @ts-expect-error this value can be anything
        handshake: { auth: { email: authEmail } },
      });
      expect(notifyPartyWithData).toHaveBeenCalledWith({ email: authEmail });
      expect(returnParty).toBe(true);
    });

    it('should query for party and notify everyone when passing email on handshake auth ', async () => {
      const authEmail = 'auth@email.com';
      const query = {
        where: { members: { some: { email: authEmail } } },
        include: {
          members: {
            include: {
              stats: true,
              appearance: true,
              profession: true,
              learnedSkills: { include: { skill: true } },
            },
          },
        },
      };
      const fakeParty = {
        members: [
          { email: 'fake1@email.com' },
          { email: 'fake1@email.com' },
          { email: 'fake1@email.com' },
        ],
      } as any;
      const findFirst = jest.fn().mockResolvedValue(fakeParty);
      prisma.party.findFirst = findFirst;
      const returnParty = await gateway.findOne({
        // @ts-expect-error this value can be anything
        handshake: { auth: { email: authEmail } },
      });
      expect(findFirst).toHaveBeenCalledWith(query);
      expect(returnParty).toBe(true);
    });

    it('should return false when not providing an email on handshake auth ', async () => {
      const findFirst = jest.fn();
      prisma.party.findFirst = findFirst;
      const returnParty = await gateway.findOne({
        // @ts-expect-error this value can be anything
        handshake: { auth: { email: undefined } },
      });
      expect(findFirst).not.toHaveBeenCalled();
      expect(returnParty).toBe(false);
    });
  });
});
