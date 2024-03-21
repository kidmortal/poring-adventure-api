import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/prisma/prisma.service';
import { WebsocketService } from 'src/websocket/websocket.service';
import { PartyService } from './party.service';
import { PartyGateway } from './party.gateway';

describe('Party Gateway', () => {
  let service: PartyService;
  let gateway: PartyGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PartyGateway, PartyService, PrismaService, WebsocketService],
    }).compile();

    service = module.get<PartyService>(PartyService);
    gateway = module.get<PartyGateway>(PartyGateway);
  });

  describe('create_party', () => {
    it('should call create service when passing email on handshake auth ', async () => {
      const authEmail = 'auth@email.com';
      const fakeReturn = {} as any;
      const create = jest.fn().mockReturnValue(fakeReturn);
      jest.spyOn(service, 'create').mockImplementation(create);
      const response = await gateway.create({
        // @ts-expect-error this value can be anything
        handshake: { auth: { email: authEmail } },
      });
      expect(create).toHaveBeenCalledWith({ email: authEmail });
      expect(response).toBe(fakeReturn);
    });
    it('should not call service and return false when not passing email on handshake auth ', async () => {
      const authEmail = undefined;
      const fakeReturn = {} as any;
      const create = jest.fn().mockReturnValue(fakeReturn);
      jest.spyOn(service, 'create').mockImplementation(create);
      const response = await gateway.create({
        // @ts-expect-error this value can be anything
        handshake: { auth: { email: authEmail } },
      });
      expect(create).not.toHaveBeenCalledWith({ email: authEmail });
      expect(response).toBe(false);
    });
  });

  describe('get_party', () => {
    it('should call getParty service when passing email on handshake auth ', async () => {
      const authEmail = 'auth@email.com';
      const fakeReturn = {} as any;
      const findOne = jest.fn().mockReturnValue(fakeReturn);
      jest.spyOn(service, 'findOne').mockImplementation(findOne);
      const response = await gateway.findOne({
        // @ts-expect-error this value can be anything
        handshake: { auth: { email: authEmail } },
      });
      expect(findOne).toHaveBeenCalledWith({ email: authEmail });
      expect(response).toBe(fakeReturn);
    });
    it('should not call service and return false when not passing email on handshake auth ', async () => {
      const authEmail = undefined;
      const fakeReturn = {} as any;
      const findOne = jest.fn().mockReturnValue(fakeReturn);
      jest.spyOn(service, 'findOne').mockImplementation(findOne);
      const response = await gateway.findOne({
        // @ts-expect-error this value can be anything
        handshake: { auth: { email: authEmail } },
      });
      expect(findOne).not.toHaveBeenCalledWith({ email: authEmail });
      expect(response).toBe(false);
    });
  });
});
