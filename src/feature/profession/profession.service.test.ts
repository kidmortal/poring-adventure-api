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
    it('creates the progression row for a profession the user does not have', async () => {
      prisma.profession.findUnique = jest.fn().mockResolvedValue({ id: 1, name: 'Mining' });
      prisma.userProfession.findUnique = jest.fn().mockResolvedValue(null);
      prisma.userProfession.create = jest.fn().mockResolvedValue({});

      const result = await service.learnProfession({ userEmail: 'test@test.com', professionId: 1 });

      expect(prisma.userProfession.create).toHaveBeenCalledWith({
        data: { userEmail: 'test@test.com', professionId: 1 },
      });
      expect(result).toBe(true);
    });

    it('refuses a profession that does not exist', async () => {
      prisma.profession.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.learnProfession({ userEmail: 'test@test.com', professionId: 99 })).rejects.toThrow(
        'Profession does not exist',
      );
    });

    it('refuses to learn the same profession twice, which would reset its level', async () => {
      prisma.profession.findUnique = jest.fn().mockResolvedValue({ id: 1, name: 'Mining' });
      prisma.userProfession.findUnique = jest.fn().mockResolvedValue({ id: 5, level: 4 });
      prisma.userProfession.create = jest.fn();

      await expect(service.learnProfession({ userEmail: 'test@test.com', professionId: 1 })).rejects.toThrow(
        'Profession already learned',
      );
      expect(prisma.userProfession.create).not.toHaveBeenCalled();
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
