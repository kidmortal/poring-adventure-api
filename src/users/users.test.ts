import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { WebsocketService } from 'src/websocket/websocket.service';
import { UsersGateway } from './users.gateway';

describe('User Gateway', () => {
  let service: UsersService;
  let gateway: UsersGateway;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersGateway, UsersService, PrismaService, WebsocketService],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    service = module.get<UsersService>(UsersService);
    gateway = module.get<UsersGateway>(UsersGateway);
  });

  describe('get_user', () => {
    it('should query for a full user and return value when passing email on handshake auth ', async () => {
      const authEmail = 'auth@email.com';
      const fullUserparams = {
        where: { email: authEmail },
        include: {
          appearance: true,
          inventory: { include: { item: true, marketListing: true } },
          equipment: { include: { item: true } },
          profession: { include: { skills: true } },
          learnedSkills: { include: { skill: true } },
          stats: true,
        },
      };
      const fakeUser = { email: authEmail } as any;
      const findUnique = jest.fn().mockResolvedValue(fakeUser);
      prisma.user.findUnique = findUnique;
      const returnUser = await gateway.findOne({
        // @ts-expect-error this value can be anything
        handshake: { auth: { email: authEmail } },
      });
      expect(findUnique).toHaveBeenCalledWith(fullUserparams);
      expect(returnUser).toBe(fakeUser);
    });

    it('should return false when not providing an email on handshake auth ', async () => {
      const findOne = jest.fn();
      jest.spyOn(service, 'findOne').mockImplementation(findOne);
      const gatewayResponse = await gateway.findOne({
        // @ts-expect-error this value can be anything
        handshake: { auth: { email: undefined } },
      });
      expect(gatewayResponse).toBe(false);
      expect(findOne).not.toHaveBeenCalled();
    });
  });

  describe('get_all_user', () => {
    it('should return value when passing email on handshake auth ', async () => {
      const fakeUsers = [{ email: 'test@test.com' }] as any;
      const findMany = jest.fn().mockResolvedValue(fakeUsers);
      prisma.user.findMany = findMany;
      const returnUsers = await gateway.findAll();
      expect(findMany).toHaveBeenCalled();
      expect(returnUsers).toBe(fakeUsers);
    });
  });
  describe('create_user', () => {
    it('should create user when passing email on handshake auth ', async () => {
      const authEmail = 'auth@email.com';
      const createUserDto = {
        professionId: 1,
        costume: 'rogue',
        email: authEmail,
        gender: 'male',
        name: 'test',
      };
      const createUserQuery = {
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
          stats: {
            create: { experience: 1 },
          },
          professionId: createUserDto.professionId,
        },
      };
      const fakeNewUser = { email: 'test@test.com' } as any;
      const create = jest.fn().mockResolvedValue(fakeNewUser);
      prisma.user.create = create;
      const returnUser = await gateway.create(createUserDto, {
        // @ts-expect-error this value can be anything
        handshake: { auth: { email: authEmail } },
      });
      expect(create).toHaveBeenCalledWith(createUserQuery);
      expect(returnUser).toBe(fakeNewUser);
    });
  });
  describe('delete_user', () => {
    it('should delete user when passing email on handshake auth ', async () => {
      const authEmail = 'auth@email.com';
      const deleteUserQuery = {
        where: { email: authEmail },
      };
      const fakeDeletedUser = { email: 'test@test.com' } as any;
      const deleteFn = jest.fn().mockResolvedValue(fakeDeletedUser);
      prisma.user.delete = deleteFn;
      const returnUser = await gateway.remove({
        // @ts-expect-error this value can be anything
        handshake: { auth: { email: authEmail } },
      });
      expect(deleteFn).toHaveBeenCalledWith(deleteUserQuery);
      expect(returnUser).toBe(fakeDeletedUser);
    });
  });
  describe('get_all_professions', () => {
    it('should fetch all professions ', async () => {
      const dbQuery = { include: { skills: true } };
      const fakeProfessionList = [{ name: 'priest' }] as any;
      const findMany = jest.fn().mockResolvedValue(fakeProfessionList);
      prisma.profession.findMany = findMany;
      const returnProfessions = await gateway.getAllClasses();
      expect(findMany).toHaveBeenCalledWith(dbQuery);
      expect(returnProfessions).toBe(fakeProfessionList);
    });
  });
});
