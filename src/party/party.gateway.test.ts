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
  describe('remove_party', () => {
    it('should call getParty service when passing email on handshake auth ', async () => {
      const authEmail = 'auth@email.com';
      const fakeReturn = {} as any;
      const remove = jest.fn().mockReturnValue(fakeReturn);
      jest.spyOn(service, 'remove').mockImplementation(remove);
      const response = await gateway.remove({
        // @ts-expect-error this value can be anything
        handshake: { auth: { email: authEmail } },
      });
      expect(remove).toHaveBeenCalledWith({ email: authEmail });
      expect(response).toBe(fakeReturn);
    });
    it('should not call service and return false when not passing email on handshake auth ', async () => {
      const authEmail = undefined;
      const fakeReturn = {} as any;
      const remove = jest.fn().mockReturnValue(fakeReturn);
      jest.spyOn(service, 'remove').mockImplementation(remove);
      const response = await gateway.remove({
        // @ts-expect-error this value can be anything
        handshake: { auth: { email: authEmail } },
      });
      expect(remove).not.toHaveBeenCalledWith({ email: authEmail });
      expect(response).toBe(false);
    });
  });
  describe('invite_to_party', () => {
    it('should call invite service when passing email on handshake auth ', async () => {
      const authEmail = 'auth@email.com';
      const invitedEmail = 'invited@email.com';
      const fakeReturn = {} as any;
      const invite = jest.fn().mockReturnValue(fakeReturn);
      jest.spyOn(service, 'invite').mockImplementation(invite);
      const response = await gateway.invite(invitedEmail, {
        // @ts-expect-error this value can be anything
        handshake: { auth: { email: authEmail } },
      });
      expect(invite).toHaveBeenCalledWith({
        leaderEmail: authEmail,
        invitedEmail,
      });
      expect(response).toBe(fakeReturn);
    });
    it('should not call service and return false when not passing email on handshake auth ', async () => {
      const authEmail = undefined;
      const invitedEmail = 'invited@email.com';
      const fakeReturn = {} as any;
      const invite = jest.fn().mockReturnValue(fakeReturn);
      jest.spyOn(service, 'invite').mockImplementation(invite);
      const response = await gateway.invite(invitedEmail, {
        // @ts-expect-error this value can be anything
        handshake: { auth: { email: authEmail } },
      });
      expect(invite).not.toHaveBeenCalledWith({ email: authEmail });
      expect(response).toBe(false);
    });
  });
  describe('kick_from_party', () => {
    it('should call kick service when passing email on handshake auth ', async () => {
      const authEmail = 'auth@email.com';
      const kickedEmail = 'kicked@email.com';
      const fakeReturn = {} as any;
      const kick = jest.fn().mockReturnValue(fakeReturn);
      jest.spyOn(service, 'kick').mockImplementation(kick);
      const response = await gateway.kick(kickedEmail, {
        // @ts-expect-error this value can be anything
        handshake: { auth: { email: authEmail } },
      });
      expect(kick).toHaveBeenCalledWith({
        leaderEmail: authEmail,
        kickedEmail,
      });
      expect(response).toBe(fakeReturn);
    });
    it('should not call service and return false when not passing email on handshake auth ', async () => {
      const authEmail = undefined;
      const kickedEmail = 'kicked@email.com';
      const fakeReturn = {} as any;
      const kick = jest.fn().mockReturnValue(fakeReturn);
      jest.spyOn(service, 'kick').mockImplementation(kick);
      const response = await gateway.kick(kickedEmail, {
        // @ts-expect-error this value can be anything
        handshake: { auth: { email: authEmail } },
      });
      expect(kick).not.toHaveBeenCalledWith({
        leaderEmail: authEmail,
        kickedEmail,
      });
      expect(response).toBe(false);
    });
  });
  describe('quit_party', () => {
    it('should call quit service when passing email on handshake auth ', async () => {
      const authEmail = 'auth@email.com';
      const partyId = 0;
      const fakeReturn = {} as any;
      const quitParty = jest.fn().mockReturnValue(fakeReturn);
      jest.spyOn(service, 'quitParty').mockImplementation(quitParty);
      const response = await gateway.quit(partyId, {
        // @ts-expect-error this value can be anything
        handshake: { auth: { email: authEmail } },
      });
      expect(quitParty).toHaveBeenCalledWith({
        email: authEmail,
        partyId,
      });
      expect(response).toBe(fakeReturn);
    });
    it('should not call service and return false when not passing email on handshake auth ', async () => {
      const authEmail = undefined;
      const partyId = 0;
      const fakeReturn = {} as any;
      const quitParty = jest.fn().mockReturnValue(fakeReturn);
      jest.spyOn(service, 'quitParty').mockImplementation(quitParty);
      const response = await gateway.quit(partyId, {
        // @ts-expect-error this value can be anything
        handshake: { auth: { email: authEmail } },
      });
      expect(quitParty).not.toHaveBeenCalledWith({
        email: authEmail,
        partyId,
      });
      expect(response).toBe(false);
    });
  });
  describe('join_party', () => {
    it('should call join service when passing email on handshake auth ', async () => {
      const authEmail = 'auth@email.com';
      const partyId = 0;
      const fakeReturn = {} as any;
      const joinParty = jest.fn().mockReturnValue(fakeReturn);
      jest.spyOn(service, 'joinParty').mockImplementation(joinParty);
      const response = await gateway.join(partyId, {
        // @ts-expect-error this value can be anything
        handshake: { auth: { email: authEmail } },
      });
      expect(joinParty).toHaveBeenCalledWith({
        email: authEmail,
        partyId,
      });
      expect(response).toBe(fakeReturn);
    });
    it('should not call service and return false when not passing email on handshake auth ', async () => {
      const authEmail = undefined;
      const partyId = 0;
      const fakeReturn = {} as any;
      const joinParty = jest.fn().mockReturnValue(fakeReturn);
      jest.spyOn(service, 'joinParty').mockImplementation(joinParty);
      const response = await gateway.join(partyId, {
        // @ts-expect-error this value can be anything
        handshake: { auth: { email: authEmail } },
      });
      expect(joinParty).not.toHaveBeenCalledWith({
        email: authEmail,
        partyId,
      });
      expect(response).toBe(false);
    });
  });
});
