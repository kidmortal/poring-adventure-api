import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { UsersRepository } from 'src/feature/users/users.repository';
import { ProfessionService } from './profession.service';

const cacheMock = () => ({ get: jest.fn(), set: jest.fn(), del: jest.fn() });

describe('Profession Service', () => {
  let service: ProfessionService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProfessionService, UsersRepository, PrismaService, { provide: CACHE_MANAGER, useValue: cacheMock() }],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    service = module.get<ProfessionService>(ProfessionService);
  });

  describe('learnProfession', () => {
    /** The swap runs in a transaction, so the tx client is what the writes land on. */
    const mockTransaction = () => {
      const tx = {
        userProfession: { create: jest.fn(), deleteMany: jest.fn() },
        // Learning resets the stamina ceiling to a level-1 trade's, so the swap
        // reads and writes the stats row on its way through.
        stats: { findUnique: jest.fn().mockResolvedValue({ stamina: 50, maxStamina: 50 }), update: jest.fn() },
      };
      prisma.$transaction = jest.fn().mockImplementation((callback) => callback(tx));
      return tx;
    };

    it('creates the progression row for a user with no profession', async () => {
      prisma.profession.findUnique = jest.fn().mockResolvedValue({ id: 1, name: 'Mining' });
      prisma.userProfession.findFirst = jest.fn().mockResolvedValue(null);
      const tx = mockTransaction();

      const result = await service.learnProfession({ userEmail: 'test@test.com', professionId: 1 });

      expect(tx.userProfession.deleteMany).not.toHaveBeenCalled();
      expect(tx.userProfession.create).toHaveBeenCalledWith({
        data: { userEmail: 'test@test.com', professionId: 1 },
      });
      expect(result).toBe(true);
    });

    it('swaps professions by dropping the current one, level and all', async () => {
      prisma.profession.findUnique = jest.fn().mockResolvedValue({ id: 2, name: 'Cooking' });
      prisma.userProfession.findFirst = jest
        .fn()
        .mockResolvedValue({ id: 5, professionId: 1, level: 4, profession: { name: 'Mining' } });
      const tx = mockTransaction();

      const result = await service.learnProfession({ userEmail: 'test@test.com', professionId: 2 });

      expect(tx.userProfession.deleteMany).toHaveBeenCalledWith({ where: { userEmail: 'test@test.com' } });
      expect(tx.userProfession.create).toHaveBeenCalledWith({
        data: { userEmail: 'test@test.com', professionId: 2 },
      });
      expect(result).toBe(true);
    });

    it('refuses a profession that does not exist', async () => {
      prisma.profession.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.learnProfession({ userEmail: 'test@test.com', professionId: 99 })).rejects.toThrow(
        'Profession does not exist',
      );
    });

    it('refuses to re-learn the profession already practiced, which would reset its level', async () => {
      prisma.profession.findUnique = jest.fn().mockResolvedValue({ id: 1, name: 'Mining' });
      prisma.userProfession.findFirst = jest
        .fn()
        .mockResolvedValue({ id: 5, professionId: 1, level: 4, profession: { name: 'Mining' } });
      prisma.$transaction = jest.fn();

      await expect(service.learnProfession({ userEmail: 'test@test.com', professionId: 1 })).rejects.toThrow(
        'Profession already learned',
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('requireLearnedProfession', () => {
    it('returns the progression when the level is high enough', async () => {
      const learned = { id: 5, level: 3, profession: { name: 'Mining' } };
      prisma.userProfession.findUnique = jest.fn().mockResolvedValue(learned);

      const result = await service.requireLearnedProfession({
        userEmail: 'test@test.com',
        professionId: 1,
        requiredLevel: 3,
      });

      expect(result).toBe(learned);
    });

    it('refuses an action from a profession the user never learned', async () => {
      prisma.userProfession.findUnique = jest.fn().mockResolvedValue(null);

      await expect(
        service.requireLearnedProfession({ userEmail: 'test@test.com', professionId: 1, requiredLevel: 1 }),
      ).rejects.toThrow('You have not learned this profession');
    });

    it('refuses an action the profession is not levelled enough for', async () => {
      prisma.userProfession.findUnique = jest
        .fn()
        .mockResolvedValue({ id: 5, level: 2, profession: { name: 'Mining' } });

      await expect(
        service.requireLearnedProfession({ userEmail: 'test@test.com', professionId: 1, requiredLevel: 5 }),
      ).rejects.toThrow('Requires Mining level 5');
    });
  });

  describe('addExperience', () => {
    it('adds experience to one profession and re-derives its level', async () => {
      prisma.userProfession.findUnique = jest.fn().mockResolvedValue({ id: 5, level: 1, experience: 90 });
      prisma.userProfession.update = jest.fn().mockResolvedValue({});
      // The new level moves the stamina ceiling, which reads the stats row.
      prisma.stats.findUnique = jest.fn().mockResolvedValue({ stamina: 50, maxStamina: 50, bonusMaxStamina: 0 });
      prisma.stats.update = jest.fn().mockResolvedValue({});

      const result = await service.addExperience({ userEmail: 'test@test.com', professionId: 1, amount: 20 });

      expect(prisma.userProfession.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { experience: 110, level: 2 },
      });
      expect(result).toBe(true);
    });

    it('does nothing when the profession is not learned', async () => {
      prisma.userProfession.findUnique = jest.fn().mockResolvedValue(null);
      prisma.userProfession.update = jest.fn();

      const result = await service.addExperience({ userEmail: 'test@test.com', professionId: 1, amount: 20 });

      expect(prisma.userProfession.update).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });
});
