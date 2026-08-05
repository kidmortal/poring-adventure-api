import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { UsersRepository } from './users.repository';
import { UserStatsService } from './userStats.service';

const cacheMock = () => ({ get: jest.fn(), set: jest.fn(), del: jest.fn() });

/** A Priest-ish block: one level is worth this much of each stat. */
const CLASS_BLOCK = { health: 10, mana: 12, attack: 1, str: 1, agi: 1, int: 3, defense: 1 };

describe('UserStatsService', () => {
  let service: UserStatsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserStatsService, UsersRepository, PrismaService, { provide: CACHE_MANAGER, useValue: cacheMock() }],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    service = module.get<UserStatsService>(UserStatsService);
    prisma.user.findUnique = jest.fn().mockResolvedValue({ email: 'joseph@test', class: CLASS_BLOCK });
    prisma.stats.update = jest.fn().mockResolvedValue({});
  });

  /** What `levelUpUser` read off the row, and what it did about it. */
  function givenRow(stats: { level: number; experience: number }) {
    prisma.stats.findUnique = jest.fn().mockResolvedValue({ userEmail: 'joseph@test', ...stats });
  }

  function levelDelta() {
    const call = (prisma.stats.update as jest.Mock).mock.calls[0]?.[0];
    return call?.data?.level;
  }

  describe('levelUpUser', () => {
    it('does nothing when the level already matches the experience', async () => {
      // 5500 is exactly level 11: the ten steps of 100…1000 are all paid for,
      // and the engine counts a step the moment its cost is met.
      givenRow({ level: 11, experience: 5500 });

      expect(await service.levelUpUser({ userEmail: 'joseph@test' })).toBe(false);
      expect(prisma.stats.update).not.toHaveBeenCalled();
    });

    it('climbs when the experience has run ahead', async () => {
      givenRow({ level: 10, experience: 5500 });

      await service.levelUpUser({ userEmail: 'joseph@test' });
      expect(levelDelta()).toEqual({ increment: 1 });
    });

    it('is idempotent: a second run has nothing left to do', async () => {
      givenRow({ level: 10, experience: 5500 });
      await service.levelUpUser({ userEmail: 'joseph@test' });

      // The row now says what the first run made it say.
      givenRow({ level: 11, experience: 5500 });
      expect(await service.levelUpUser({ userEmail: 'joseph@test' })).toBe(false);
    });

    /**
     * The bug this was written for: the level used to come from the caller's
     * in-memory copy of the player. For a party member that copy is a snapshot
     * out of the party cache, which reward writes never invalidate, so the same
     * stale experience re-derived the same level-up on every fight and drove
     * the row's level far past what its experience justified.
     */
    it('reads the row, not a stale copy of it', async () => {
      givenRow({ level: 11, experience: 5500 });

      // A caller holding a much older snapshot cannot move anything: there is
      // nowhere left to pass one in, and the row agrees with itself.
      expect(await service.levelUpUser({ userEmail: 'joseph@test' })).toBe(false);
    });

    it('gives back exactly the stat blocks the wrong levels took', async () => {
      // Level 17 on a level 11 character's experience: the repair case.
      givenRow({ level: 17, experience: 5500 });

      await service.levelUpUser({ userEmail: 'joseph@test' });
      const data = (prisma.stats.update as jest.Mock).mock.calls[0][0].data;
      expect(data.level).toEqual({ decrement: 6 });
      expect(data.maxHealth).toEqual({ decrement: CLASS_BLOCK.health * 6 });
      expect(data.maxMana).toEqual({ decrement: CLASS_BLOCK.mana * 6 });
    });
  });
});
