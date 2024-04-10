import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { WebsocketService } from 'src/websocket/websocket.service';
import { UsersGateway } from './users.gateway';

describe('User Gateway', () => {
  let service: UsersService;
  let gateway: UsersGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersGateway, UsersService, PrismaService, WebsocketService],
    }).compile();

    service = module.get<UsersService>(UsersService);
    gateway = module.get<UsersGateway>(UsersGateway);
  });

  describe('get_user', () => {
    it('should call findOne service and notify user when passing email on handshake auth ', async () => {
      const authEmail = 'auth@email.com';
      const fakeUser = { email: authEmail } as any;
      const findOne = jest.fn().mockReturnValue(fakeUser);
      const notify = jest.fn().mockReturnValue(fakeUser);
      jest.spyOn(service, 'findOne').mockImplementation(findOne);
      jest.spyOn(service, 'notifyUserUpdate').mockImplementation(notify);
      const returnUser = await gateway.findOne({
        // @ts-expect-error this value can be anything
        handshake: { auth: { email: authEmail } },
      });
      expect(findOne).toHaveBeenCalledWith(authEmail);
      expect(notify).toHaveBeenCalled();
      expect(returnUser).toBe(fakeUser);
    });

    it('should return false and not call services when not providing an email on handshake auth ', async () => {
      const authEmail = 'auth@email.com';
      const fakeUser = { email: authEmail } as any;
      const findOne = jest.fn().mockReturnValue(fakeUser);
      jest.spyOn(service, 'findOne').mockImplementation(findOne);
      const returnUser = await gateway.findOne({
        // @ts-expect-error this value can be anything
        handshake: { auth: { email: undefined } },
      });
      expect(findOne).not.toHaveBeenCalled();
      expect(returnUser).toBe(false);
    });

    it('should return false when no user has been found ', async () => {
      const authEmail = 'auth@email.com';
      const fakeUser = undefined as any;
      const findOne = jest.fn().mockReturnValue(fakeUser);
      const notify = jest.fn().mockReturnValue(fakeUser);
      jest.spyOn(service, 'findOne').mockImplementation(findOne);
      jest.spyOn(service, 'notifyUserUpdate').mockImplementation(notify);
      const returnUser = await gateway.findOne({
        // @ts-expect-error this value can be anything
        handshake: { auth: { email: authEmail } },
      });
      expect(findOne).toHaveBeenCalledWith(authEmail);
      expect(notify).not.toHaveBeenCalled();
      expect(returnUser).toBe(false);
    });
  });

  describe('get_all_user', () => {
    it('should call findAll service ', async () => {
      const fakeReturn = {} as any;
      const findAll = jest.fn().mockReturnValue(fakeReturn);
      jest.spyOn(service, 'findAll').mockImplementation(findAll);
      const returnUser = await gateway.findAll({ page: 1 });
      expect(findAll).toHaveBeenCalled();
      expect(returnUser).toBe(fakeReturn);
    });
  });
  describe('create_user', () => {
    it('should call create service and notify user when passing email on handshake auth ', async () => {
      const authEmail = 'auth@email.com';
      const createUserDto = {
        professionId: 1,
        costume: 'rogue',
        email: authEmail,
        gender: 'male',
        name: 'test',
      };
      const fakeReturn = {} as any;
      const create = jest.fn().mockReturnValue(fakeReturn);
      jest.spyOn(service, 'create').mockImplementation(create);
      const returnUser = await gateway.create(createUserDto, {
        // @ts-expect-error this value can be anything
        handshake: { auth: { email: authEmail } },
      });
      expect(create).toHaveBeenCalledWith(createUserDto);
      expect(returnUser).toBe(fakeReturn);
    });

    it('should return false and not call services when not providing an email on handshake auth ', async () => {
      const createUserDto = {
        professionId: 1,
        costume: 'rogue',
        email: 'fake@email.com',
        gender: 'male',
        name: 'test',
      };
      const fakeReturn = {} as any;
      const create = jest.fn().mockReturnValue(fakeReturn);
      jest.spyOn(service, 'create').mockImplementation(create);
      const returnUser = await gateway.create(createUserDto, {
        // @ts-expect-error this value can be anything
        handshake: { auth: { email: undefined } },
      });
      expect(create).not.toHaveBeenCalled();
      expect(returnUser).toBe(false);
    });
  });
  describe('delete_user', () => {
    it('should call deleteUser service when passing email on handshake auth ', async () => {
      const authEmail = 'auth@email.com';
      const fakeReturn = {} as any;
      const deleteUser = jest.fn().mockReturnValue(fakeReturn);
      jest.spyOn(service, 'deleteUser').mockImplementation(deleteUser);
      const returnUser = await gateway.remove({
        // @ts-expect-error this value can be anything
        handshake: { auth: { email: authEmail } },
      });
      expect(deleteUser).toHaveBeenCalledWith(authEmail);
      expect(returnUser).toBe(fakeReturn);
    });

    it('should return false and not call services when not providing an email on handshake auth ', async () => {
      const deleteUser = jest.fn();
      jest.spyOn(service, 'deleteUser').mockImplementation(deleteUser);
      const returnUser = await gateway.remove({
        // @ts-expect-error this value can be anything
        handshake: { auth: { email: undefined } },
      });
      expect(deleteUser).not.toHaveBeenCalled();
      expect(returnUser).toBe(false);
    });
  });
  describe('get_all_professions', () => {
    it('should call get_all_professions service', async () => {
      const fakeReturn = {} as any;
      const getAllProfessions = jest.fn().mockReturnValue(fakeReturn);
      jest
        .spyOn(service, 'getAllProfessions')
        .mockImplementation(getAllProfessions);
      const returnUser = await gateway.getAllClasses();
      expect(getAllProfessions).toHaveBeenCalled();
      expect(returnUser).toBe(fakeReturn);
    });
  });
});
