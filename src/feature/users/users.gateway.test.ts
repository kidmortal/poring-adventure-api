import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { UsersRepository } from 'src/feature/users/users.repository';
import { UsersService } from './users.service';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { UsersGateway } from './users.gateway';

describe('User Gateway', () => {
  let service: UsersService;
  let gateway: UsersGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersGateway,
        UsersService,
        UsersRepository,
        PrismaService,
        WebsocketService,
        { provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    gateway = module.get<UsersGateway>(UsersGateway);
  });

  describe('get_user', () => {
    it('should call findOne with the email from the handshake', async () => {
      const authEmail = 'auth@email.com';
      const findOne = jest.fn().mockResolvedValue(true);
      jest.spyOn(service, 'findOne').mockImplementation(findOne);
      const result = await gateway.findOne({
        // @ts-expect-error this value can be anything
        handshake: { auth: { email: authEmail } },
      });
      expect(findOne).toHaveBeenCalledWith({ userEmail: authEmail });
      expect(result).toBe(true);
    });
  });

  describe('get_all_user', () => {
    it('should call findAll service ', async () => {
      const fakeReturn = {} as any;
      const findAll = jest.fn().mockReturnValue(fakeReturn);
      jest.spyOn(service, 'getUsersPage').mockImplementation(findAll);
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
      expect(create).toHaveBeenCalledWith({ ...createUserDto, email: authEmail });
      expect(returnUser).toBe(fakeReturn);
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
  });
  describe('get_all_professions', () => {
    it('should call get_all_professions service', async () => {
      const fakeReturn = {} as any;
      const getAllProfessions = jest.fn().mockReturnValue(fakeReturn);
      jest.spyOn(service, 'getAllProfessions').mockImplementation(getAllProfessions);
      const returnUser = await gateway.getAllClasses();
      expect(getAllProfessions).toHaveBeenCalled();
      expect(returnUser).toBe(fakeReturn);
    });
  });
});
