import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { UserStaminaService } from './userStamina.service';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { WebsocketService } from 'src/core/websocket/websocket.service';

const cacheMock = () => ({ get: jest.fn(), set: jest.fn(), del: jest.fn() });

describe('User Service', () => {
  let service: UsersService;
  let prisma: PrismaService;
  let socket: WebsocketService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        UsersRepository,
        UserStaminaService,
        PrismaService,
        WebsocketService,
        { provide: CACHE_MANAGER, useValue: cacheMock() },
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    service = module.get<UsersService>(UsersService);
    socket = module.get<WebsocketService>(WebsocketService);
  });

  describe('findOne', () => {
    it('should load the full profile and push it to the user sockets', async () => {
      const authEmail = 'auth@email.com';
      const fakeUser = { email: authEmail } as any;
      prisma.user.findUnique = jest.fn().mockResolvedValue(fakeUser);
      // Reading the profile also checks the daily stamina refill.
      prisma.stats.findUnique = jest.fn().mockResolvedValue({ staminaRefilledAt: new Date(), maxStamina: 50 });
      const sendMessageToSocket = jest.fn().mockResolvedValue(true);
      socket.sendMessageToSocket = sendMessageToSocket;

      const result = await service.findOne({ userEmail: authEmail });

      expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { email: authEmail } }));
      expect(sendMessageToSocket).toHaveBeenCalledWith({
        email: authEmail,
        event: 'user_update',
        payload: fakeUser,
      });
      expect(result).toBe(true);
    });
  });

  describe('getUsersPage', () => {
    it('should return the page alongside the total count', async () => {
      const fakeUsers = [{ email: 'test@test.com' }] as any;
      prisma.user.findMany = jest.fn().mockResolvedValue(fakeUsers);
      prisma.user.count = jest.fn().mockResolvedValue(1);

      const result = await service.getUsersPage({ page: 1 });

      expect(result).toEqual({ users: fakeUsers, count: 1 });
    });
  });

  describe('create', () => {
    it('should create the user with appearance and starting stats', async () => {
      const createUserDto = {
        classId: 1,
        costume: 'rogue',
        email: 'auth@email.com',
        gender: 'male',
        name: 'test',
      };
      const fakeNewUser = { email: 'test@test.com' } as any;
      prisma.user.create = jest.fn().mockResolvedValue(fakeNewUser);

      const returnUser = await service.create(createUserDto);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          name: createUserDto.name,
          email: createUserDto.email,
          appearance: {
            create: {
              costume: createUserDto.costume,
              gender: createUserDto.gender,
              head: '1',
            },
          },
          stats: { create: { experience: 1 } },
          classId: createUserDto.classId,
        },
      });
      expect(returnUser).toBe(fakeNewUser);
    });
  });

  describe('deleteUser', () => {
    it('should delete user', async () => {
      const authEmail = 'auth@email.com';
      const fakeDeletedUser = { email: 'test@test.com' } as any;
      prisma.user.delete = jest.fn().mockResolvedValue(fakeDeletedUser);

      const returnUser = await service.deleteUser(authEmail);

      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { email: authEmail } });
      expect(returnUser).toBe(fakeDeletedUser);
    });
  });

  describe('getAllClasses', () => {
    it('should return list of classes', async () => {
      const fakeReturn = {} as any;
      prisma.class.findMany = jest.fn().mockResolvedValue(fakeReturn);

      const result = await service.getAllClasses();

      expect(prisma.class.findMany).toHaveBeenCalled();
      expect(result).toBe(fakeReturn);
    });
  });

  describe('notifyUserUpdate', () => {
    it('should notify user', async () => {
      const args = { email: 'test@test.com', payload: { message: 'yes' } };
      const sendMessageToSocket = jest.fn().mockResolvedValue(true);
      socket.sendMessageToSocket = sendMessageToSocket;

      const result = await service.notifyUserUpdate(args);

      expect(sendMessageToSocket).toHaveBeenCalledWith({
        email: args.email,
        event: 'user_update',
        payload: args.payload,
      });
      expect(result).toBe(true);
    });
  });
});
