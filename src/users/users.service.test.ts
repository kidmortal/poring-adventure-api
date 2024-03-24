import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { WebsocketService } from 'src/websocket/websocket.service';

describe('User Service', () => {
  let service: UsersService;
  let prisma: PrismaService;
  let socket: WebsocketService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, PrismaService, WebsocketService],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    service = module.get<UsersService>(UsersService);
    socket = module.get<WebsocketService>(WebsocketService);
  });

  describe('findOne', () => {
    it('should query for a full user and return value when passing email on handshake auth ', async () => {
      const authEmail = 'auth@email.com';
      const fullUserparams = {
        where: { email: authEmail },
        include: {
          appearance: true,
          inventory: { include: { item: true, marketListing: true } },
          equipment: { include: { item: true } },
          profession: { include: { skills: true } },
          learnedSkills: { include: { skill: { include: { buff: true } } } },
          buffs: { include: { buff: true } },
          stats: true,
        },
      };
      const fakeUser = { email: authEmail } as any;
      const findUnique = jest.fn().mockResolvedValue(fakeUser);
      prisma.user.findUnique = findUnique;
      const returnUser = await service.findOne(authEmail);
      expect(findUnique).toHaveBeenCalledWith(fullUserparams);
      expect(returnUser).toBe(fakeUser);
    });
  });

  describe('findAll', () => {
    it('should return value when passing email on handshake auth ', async () => {
      const fakeUsers = [{ email: 'test@test.com' }] as any;
      const findMany = jest.fn().mockResolvedValue(fakeUsers);
      prisma.user.findMany = findMany;
      const returnUsers = await service.findAll();
      expect(findMany).toHaveBeenCalled();
      expect(returnUsers).toBe(fakeUsers);
    });
  });
  describe('create', () => {
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
      const returnUser = await service.create(createUserDto);
      expect(create).toHaveBeenCalledWith(createUserQuery);
      expect(returnUser).toBe(fakeNewUser);
    });
  });
  describe('deleteUser', () => {
    it('should delete user', async () => {
      const authEmail = 'auth@email.com';
      const deleteUserQuery = {
        where: { email: authEmail },
      };
      const fakeDeletedUser = { email: 'test@test.com' } as any;
      const deleteFn = jest.fn().mockResolvedValue(fakeDeletedUser);
      prisma.user.delete = deleteFn;
      const returnUser = await service.deleteUser(authEmail);
      expect(deleteFn).toHaveBeenCalledWith(deleteUserQuery);
      expect(returnUser).toBe(fakeDeletedUser);
    });
  });
  describe('getAllProfessions', () => {
    it('should return list of professions', async () => {
      const fakeReturn = {} as any;
      const findMany = jest.fn().mockResolvedValue(fakeReturn);
      prisma.profession.findMany = findMany;
      const result = await service.getAllProfessions();
      expect(findMany).toHaveBeenCalled();
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

  describe('updateUserHealthMana', () => {
    it('should update user health and mana but dont allow it', async () => {
      const args = {
        userEmail: 'test@test.com',
        health: 25,
        mana: 25,
      };
      const fakeReturn = {} as any;
      const update = jest.fn().mockResolvedValue(fakeReturn);
      prisma.stats.update = update;
      const result = await service.updateUserHealthMana(args);
      expect(update).toHaveBeenCalledWith({
        where: {
          userEmail: args.userEmail,
        },
        data: {
          health: args.health,
          mana: args.mana,
        },
      });
      expect(result).toBe(fakeReturn);
    });
  });
  describe('incrementUserHealth', () => {
    it('should update user health', async () => {
      const args = {
        userEmail: 'test@test.com',
        amount: 10,
      };
      const fakeUpdate = {} as any;
      const fakeStats = { maxHealth: 50, health: 30 } as any;
      const update = jest.fn().mockResolvedValue(fakeUpdate);
      const findUniqueStats = jest.fn().mockResolvedValue(fakeStats);
      prisma.stats.findUnique = findUniqueStats;
      prisma.stats.update = update;
      const result = await service.incrementUserHealth(args);
      expect(findUniqueStats).toHaveBeenCalled();
      expect(update).toHaveBeenCalledWith({
        where: { userEmail: args.userEmail },
        //  40, because 30 + 10
        data: { health: { set: 40 } },
      });
      expect(result).toBe(fakeUpdate);
    });
    it('should update user health but dont allow it to overflow the max cap', async () => {
      const args = {
        userEmail: 'test@test.com',
        amount: 25,
      };
      const fakeUpdate = {} as any;
      const fakeStats = { maxHealth: 50, health: 40 } as any;
      const update = jest.fn().mockResolvedValue(fakeUpdate);
      const findUniqueStats = jest.fn().mockResolvedValue(fakeStats);
      prisma.stats.findUnique = findUniqueStats;
      prisma.stats.update = update;
      const result = await service.incrementUserHealth(args);
      expect(findUniqueStats).toHaveBeenCalled();
      expect(update).toHaveBeenCalledWith({
        where: { userEmail: args.userEmail },
        // only 50, because 40 + 25 would overflow to 65
        data: { health: { set: 50 } },
      });
      expect(result).toBe(fakeUpdate);
    });
  });
  describe('decrementUserHealth', () => {
    it('should update user health', async () => {
      const args = { userEmail: '', amount: 20 };
      const fakeUpdate = {} as any;
      const fakeStats = { health: 30 } as any;
      const update = jest.fn().mockResolvedValue(fakeUpdate);
      const findUniqueStats = jest.fn().mockResolvedValue(fakeStats);
      prisma.stats.findUnique = findUniqueStats;
      prisma.stats.update = update;
      const result = await service.decrementUserHealth(args);
      expect(findUniqueStats).toHaveBeenCalled();
      expect(update).toHaveBeenCalledWith({
        where: { userEmail: args.userEmail },
        // should set to 10, because 30 - 20 is 10
        data: { health: { set: 10 } },
      });
      expect(result).toBe(fakeUpdate);
    });

    it('should update user health but dont allow it to go below 0', async () => {
      const args = { userEmail: '', amount: 25 };
      const fakeUpdate = {} as any;
      const fakeStats = { maxHealth: 20, health: 15 } as any;
      const update = jest.fn().mockResolvedValue(fakeUpdate);
      const findUniqueStats = jest.fn().mockResolvedValue(fakeStats);
      prisma.stats.findUnique = findUniqueStats;
      prisma.stats.update = update;
      const result = await service.decrementUserHealth(args);
      expect(findUniqueStats).toHaveBeenCalled();
      expect(update).toHaveBeenCalledWith({
        where: { userEmail: args.userEmail },
        // should set to 0, because 15 - 25 is -15, which isnt allowed
        data: { health: { set: 0 } },
      });
      expect(result).toBe(fakeUpdate);
    });
  });

  describe('incrementUserMana', () => {
    it('should update user mana', async () => {
      const args = {
        userEmail: 'test@test.com',
        amount: 10,
      };
      const fakeUpdate = {} as any;
      const fakeStats = { maxMana: 50, mana: 30 } as any;
      const update = jest.fn().mockResolvedValue(fakeUpdate);
      const findUniqueStats = jest.fn().mockResolvedValue(fakeStats);
      prisma.stats.findUnique = findUniqueStats;
      prisma.stats.update = update;
      const result = await service.incrementUserMana(args);
      expect(findUniqueStats).toHaveBeenCalled();
      expect(update).toHaveBeenCalledWith({
        where: { userEmail: args.userEmail },
        // 40, because 30 + 10
        data: { mana: { set: 40 } },
      });
      expect(result).toBe(fakeUpdate);
    });

    it('should update user mana but dont allow it to overflow the max cap', async () => {
      const args = {
        userEmail: 'test@test.com',
        amount: 25,
      };
      const fakeUpdate = {} as any;
      const fakeStats = { maxMana: 50, mana: 40 } as any;
      const update = jest.fn().mockResolvedValue(fakeUpdate);
      const findUniqueStats = jest.fn().mockResolvedValue(fakeStats);
      prisma.stats.findUnique = findUniqueStats;
      prisma.stats.update = update;
      const result = await service.incrementUserMana(args);
      expect(findUniqueStats).toHaveBeenCalled();
      expect(update).toHaveBeenCalledWith({
        where: { userEmail: args.userEmail },
        // only 50, because 40 + 25 would overflow to 65
        data: { mana: { set: 50 } },
      });
      expect(result).toBe(fakeUpdate);
    });
  });
  describe('decrementUserMana', () => {
    it('should update user mana', async () => {
      const args = { userEmail: '', amount: 20 };
      const fakeUpdate = {} as any;
      const fakeStats = { mana: 30 } as any;
      const update = jest.fn().mockResolvedValue(fakeUpdate);
      const findUniqueStats = jest.fn().mockResolvedValue(fakeStats);
      prisma.stats.findUnique = findUniqueStats;
      prisma.stats.update = update;
      const result = await service.decrementUserMana(args);
      expect(findUniqueStats).toHaveBeenCalled();
      expect(update).toHaveBeenCalledWith({
        where: { userEmail: args.userEmail },
        // should set to 10, because 30 - 20 is 10
        data: { mana: { set: 10 } },
      });
      expect(result).toBe(fakeUpdate);
    });

    it('should update user mana but dont allow it to go below 0', async () => {
      const args = { userEmail: '', amount: 25 };
      const fakeUpdate = {} as any;
      const fakeStats = { maxMana: 20, mana: 15 } as any;
      const update = jest.fn().mockResolvedValue(fakeUpdate);
      const findUniqueStats = jest.fn().mockResolvedValue(fakeStats);
      prisma.stats.findUnique = findUniqueStats;
      prisma.stats.update = update;
      const result = await service.decrementUserMana(args);
      expect(findUniqueStats).toHaveBeenCalled();
      expect(update).toHaveBeenCalledWith({
        where: { userEmail: args.userEmail },
        // should set to 0, because 15 - 25 is -15, which isnt allowed
        data: { mana: { set: 0 } },
      });
      expect(result).toBe(fakeUpdate);
    });
  });

  describe('increaseUserStats', () => {
    it('should increase user stats received by params, and add 0 when no value is passed', async () => {
      const args = {
        userEmail: '',
        level: 1,
        health: 1,
        mana: 1,
        attack: 1,
        // str: 1,
        // int: 1,
        // agi: 1,
      };
      const fakeUpdate = {} as any;
      const update = jest.fn().mockResolvedValue(fakeUpdate);
      prisma.stats.update = update;
      const result = await service.increaseUserStats(args);
      expect(update).toHaveBeenCalledWith({
        where: {
          userEmail: args.userEmail,
        },
        data: {
          level: { increment: args.level },
          maxHealth: { increment: args.health },
          maxMana: { increment: args.mana },
          attack: { increment: args.attack },
          str: { increment: 0 },
          agi: { increment: 0 },
          int: { increment: 0 },
        },
      });
      expect(result).toBe(fakeUpdate);
    });
  });

  describe('decreaseUserStats', () => {
    it('should decrease user stats received by params, and add 0 when no value is passed', async () => {
      const args = {
        userEmail: '',
        level: 1,
        health: 1,
        mana: 1,
        attack: 1,
        // str: 1,
        // int: 1,
        // agi: 1,
      };
      const fakeUpdate = {} as any;
      const update = jest.fn().mockResolvedValue(fakeUpdate);
      prisma.stats.update = update;
      const result = await service.decreaseUserStats(args);
      expect(update).toHaveBeenCalledWith({
        where: {
          userEmail: args.userEmail,
        },
        data: {
          level: { decrement: args.level },
          maxHealth: { decrement: args.health },
          maxMana: { decrement: args.mana },
          attack: { decrement: args.attack },
          str: { decrement: 0 },
          agi: { decrement: 0 },
          int: { decrement: 0 },
        },
      });
      expect(result).toBe(fakeUpdate);
    });
  });

  describe('increaseUserLevel', () => {
    it('should increase user level and stats based on user profession', async () => {
      const args = {
        userEmail: 'email',
        amount: 10,
      };
      const fakeUpdate = {} as any;
      const fakeUser = {
        profession: {
          health: 10,
          mana: 10,
          attack: 10,
          str: 10,
          agi: 10,
          int: 10,
        },
      } as any;

      const increaseUserStats = jest.fn().mockResolvedValue(fakeUpdate);
      const findUnique = jest.fn().mockResolvedValue(fakeUser);
      prisma.user.findUnique = findUnique;
      service.increaseUserStats = increaseUserStats;

      await service.increaseUserLevel(args);
      expect(findUnique).toHaveBeenCalledWith({
        where: { email: args.userEmail },
        include: { profession: true },
      });

      expect(increaseUserStats).toHaveBeenCalledWith({
        userEmail: args.userEmail,
        level: args.amount,
        health: args.amount * fakeUser.profession.health,
        attack: args.amount * fakeUser.profession.attack,
        mana: args.amount * fakeUser.profession.mana,
        str: args.amount * fakeUser.profession.str,
        agi: args.amount * fakeUser.profession.agi,
        int: args.amount * fakeUser.profession.int,
      });
    });
  });

  describe('decreaseUserLevel', () => {
    it('should decrease user level and stats based on user profession', async () => {
      const args = {
        userEmail: 'email',
        amount: 10,
      };
      const fakeUpdate = {} as any;
      const fakeUser = {
        profession: {
          health: 10,
          mana: 10,
          attack: 10,
          str: 10,
          agi: 10,
          int: 10,
        },
      } as any;

      const decreaseUserStats = jest.fn().mockResolvedValue(fakeUpdate);
      const findUnique = jest.fn().mockResolvedValue(fakeUser);
      prisma.user.findUnique = findUnique;
      service.decreaseUserStats = decreaseUserStats;

      await service.decreaseUserLevel(args);
      expect(findUnique).toHaveBeenCalledWith({
        where: { email: args.userEmail },
        include: { profession: true },
      });

      expect(decreaseUserStats).toHaveBeenCalledWith({
        userEmail: args.userEmail,
        level: args.amount,
        health: args.amount * fakeUser.profession.health,
        attack: args.amount * fakeUser.profession.attack,
        mana: args.amount * fakeUser.profession.mana,
        str: args.amount * fakeUser.profession.str,
        agi: args.amount * fakeUser.profession.agi,
        int: args.amount * fakeUser.profession.int,
      });
    });
  });
});
