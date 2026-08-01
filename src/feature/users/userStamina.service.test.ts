import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { UsersRepository } from './users.repository';
import { UserStaminaService } from './userStamina.service';

const cacheMock = () => ({ get: jest.fn(), set: jest.fn(), del: jest.fn() });

describe('User Stamina Service', () => {
  let service: UserStaminaService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserStaminaService,
        UsersRepository,
        PrismaService,
        { provide: CACHE_MANAGER, useValue: cacheMock() },
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    service = module.get<UserStaminaService>(UserStaminaService);
  });

  describe('refillIfNewDay', () => {
    it('tops the bar up when the last refill was on an earlier day', async () => {
      prisma.stats.findUnique = jest.fn().mockResolvedValue({
        stamina: 3,
        maxStamina: 50,
        staminaRefilledAt: new Date('2024-07-31T10:00:00Z'),
      });
      prisma.stats.update = jest.fn().mockResolvedValue({});

      const result = await service.refillIfNewDay({ userEmail: 'test@test.com' });

      expect(prisma.stats.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ stamina: 50 }) }),
      );
      expect(result).toBe(true);
    });

    it('leaves the bar alone when it was already refilled today', async () => {
      prisma.stats.findUnique = jest.fn().mockResolvedValue({
        stamina: 3,
        maxStamina: 50,
        staminaRefilledAt: new Date(),
      });
      prisma.stats.update = jest.fn();

      const result = await service.refillIfNewDay({ userEmail: 'test@test.com' });

      expect(prisma.stats.update).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe('consumeStamina', () => {
    it('spends stamina when the user has enough', async () => {
      prisma.stats.findUnique = jest.fn().mockResolvedValue({
        stamina: 20,
        maxStamina: 50,
        staminaRefilledAt: new Date(),
      });
      prisma.stats.update = jest.fn().mockResolvedValue({});

      const result = await service.consumeStamina({ userEmail: 'test@test.com', amount: 5 });

      expect(prisma.stats.update).toHaveBeenCalledWith({
        where: { userEmail: 'test@test.com' },
        data: { stamina: { decrement: 5 } },
      });
      expect(result).toBe(true);
    });

    it('refuses to go negative', async () => {
      prisma.stats.findUnique = jest.fn().mockResolvedValue({
        stamina: 2,
        maxStamina: 50,
        staminaRefilledAt: new Date(),
      });
      prisma.stats.update = jest.fn();

      await expect(service.consumeStamina({ userEmail: 'test@test.com', amount: 5 })).rejects.toThrow(
        'Not enough stamina',
      );
      expect(prisma.stats.update).not.toHaveBeenCalled();
    });

    it('grants the new day budget before spending it', async () => {
      // Offline since yesterday with an empty bar: the refill has to happen
      // first or the action would be refused.
      prisma.stats.findUnique = jest
        .fn()
        .mockResolvedValueOnce({ stamina: 0, maxStamina: 50, staminaRefilledAt: new Date('2024-07-31T10:00:00Z') })
        .mockResolvedValueOnce({ stamina: 50, maxStamina: 50, staminaRefilledAt: new Date() });
      prisma.stats.update = jest.fn().mockResolvedValue({});

      const result = await service.consumeStamina({ userEmail: 'test@test.com', amount: 5 });

      expect(result).toBe(true);
    });
  });

  describe('addStamina', () => {
    it('never goes past the maximum', async () => {
      prisma.stats.findUnique = jest.fn().mockResolvedValue({ stamina: 48, maxStamina: 50 });
      prisma.stats.update = jest.fn().mockResolvedValue({});

      await service.addStamina({ userEmail: 'test@test.com', amount: 10 });

      expect(prisma.stats.update).toHaveBeenCalledWith({
        where: { userEmail: 'test@test.com' },
        data: { stamina: 50 },
      });
    });
  });
});
