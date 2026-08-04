import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

import { PrismaService } from 'src/core/prisma/prisma.service';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { UsersRepository } from 'src/feature/users/users.repository';
import { DungeonService } from './dungeon.service';

/** The gates around a run: one entry a day, one run at a time, party-wide. */
describe('Dungeon service', () => {
  const LEADER = 'leader@test.com';
  const MATE = 'mate@test.com';

  const yesterday = new Date(Date.now() - 1000 * 60 * 60 * 48);
  const participants = [
    { email: LEADER, name: 'Kidmortal' },
    { email: MATE, name: 'Joseph' },
  ];

  const bosses = [
    { id: 1, dungeonId: 4, stage: 1, name: 'Grave Familiar', health: 100, drops: [] },
    { id: 2, dungeonId: 4, stage: 2, name: 'Crypt Demon', health: 200, drops: [] },
    { id: 3, dungeonId: 4, stage: 3, name: 'Kades', health: 400, drops: [] },
  ];
  const dungeon = { id: 4, name: 'Forgotten Crypt', monsters: bosses };

  let service: DungeonService;
  let prisma: any;
  let websocket: { sendErrorNotification: jest.Mock; sendMessageToSocket: jest.Mock; sendTextNotification: jest.Mock };

  /** The last error the service pushed at the caller. */
  const denial = () => websocket.sendErrorNotification.mock.calls.at(-1)?.[0]?.text;

  beforeEach(async () => {
    prisma = {
      dungeon: { findUnique: jest.fn().mockResolvedValue(dungeon), findMany: jest.fn().mockResolvedValue([dungeon]) },
      dungeonEntry: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
      dungeonRun: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 55 }),
        update: jest.fn(),
      },
      dungeonRunMember: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findUnique: jest.fn().mockResolvedValue({ partyId: null }), findMany: jest.fn().mockResolvedValue([]) },
      stats: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
      $transaction: jest.fn((work: any) => work(prisma)),
    };
    websocket = {
      sendErrorNotification: jest.fn(),
      sendMessageToSocket: jest.fn(),
      sendTextNotification: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DungeonService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersRepository, useValue: { clearUserCache: jest.fn() } },
        { provide: WebsocketService, useValue: websocket },
        { provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } },
      ],
    }).compile();

    service = module.get(DungeonService);
  });

  describe('prepareEntry', () => {
    it('lets a party with entries in, at the first boss', async () => {
      const prepared = await service.prepareEntry({ userEmail: LEADER, participants, dungeonId: 4 });

      expect(prepared?.boss.stage).toBe(1);
      expect(prepared?.emails).toEqual([LEADER, MATE]);
    });

    it('lets someone back in the next day', async () => {
      prisma.dungeonEntry.findMany.mockResolvedValue([
        { userEmail: LEADER, usedAt: yesterday },
        { userEmail: MATE, usedAt: yesterday },
      ]);

      const prepared = await service.prepareEntry({ userEmail: LEADER, participants, dungeonId: 4 });
      expect(prepared).toBeDefined();
    });

    it('stops the whole party when one member has already run it today', async () => {
      prisma.dungeonEntry.findMany.mockResolvedValue([{ userEmail: MATE, usedAt: new Date() }]);

      const prepared = await service.prepareEntry({ userEmail: LEADER, participants, dungeonId: 4 });

      expect(prepared).toBeUndefined();
      // Named, not emailed — the party knows each other by nickname.
      expect(denial()).toBe('Joseph has already run Forgotten Crypt today');
    });

    it('says "you" rather than naming the caller back at themselves', async () => {
      prisma.dungeonEntry.findMany.mockResolvedValue([{ userEmail: LEADER, usedAt: new Date() }]);

      await service.prepareEntry({ userEmail: LEADER, participants, dungeonId: 4 });
      expect(denial()).toBe('You have already run Forgotten Crypt today');
    });

    it('refuses a second run while one is still standing', async () => {
      prisma.dungeonRun.findFirst.mockResolvedValue({
        id: 9,
        startedAt: new Date(),
        dungeon: { name: 'Forgotten Crypt' },
        members: [{ userEmail: LEADER }],
      });

      const prepared = await service.prepareEntry({ userEmail: LEADER, participants, dungeonId: 4 });

      expect(prepared).toBeUndefined();
      expect(denial()).toBe('You are already inside Forgotten Crypt');
    });

    it('blames the party member who is the one still inside', async () => {
      prisma.dungeonRun.findFirst.mockResolvedValue({
        id: 9,
        startedAt: new Date(),
        dungeon: { name: 'Forgotten Crypt' },
        members: [{ userEmail: MATE }],
      });

      await service.prepareEntry({ userEmail: LEADER, participants, dungeonId: 4 });
      expect(denial()).toBe('Someone in your party is already inside Forgotten Crypt');
    });

    it('turns away a dungeon that does not exist', async () => {
      prisma.dungeon.findUnique.mockResolvedValue(null);

      expect(await service.prepareEntry({ userEmail: LEADER, participants, dungeonId: 99 })).toBeUndefined();
      expect(denial()).toBe('No such dungeon');
    });

    it('turns away a dungeon with nothing standing in it', async () => {
      prisma.dungeon.findUnique.mockResolvedValue({ ...dungeon, monsters: [] });

      expect(await service.prepareEntry({ userEmail: LEADER, participants, dungeonId: 4 })).toBeUndefined();
    });

    it("closes yesterday's run rather than letting it block today's entry", async () => {
      prisma.dungeonRun.findMany.mockResolvedValue([{ id: 9, startedAt: yesterday }]);

      const prepared = await service.prepareEntry({ userEmail: LEADER, participants, dungeonId: 4 });

      expect(prisma.dungeonRun.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 9 }, data: expect.objectContaining({ status: 'failed' }) }),
      );
      expect(prepared).toBeDefined();
    });
  });

  describe('startRun', () => {
    it('spends the entry of everyone walking in, before the first blow', async () => {
      await service.startRun({ dungeonId: 4, leaderEmail: LEADER, emails: [LEADER, MATE] });

      expect(prisma.dungeonEntry.upsert).toHaveBeenCalledTimes(2);
      expect(prisma.dungeonRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ dungeonId: 4, leaderEmail: LEADER }),
        }),
      );
    });
  });

  describe('prepareNextFight', () => {
    const activeRun = (stage: number) => ({
      id: 55,
      stage,
      status: 'active',
      startedAt: new Date(),
      leaderEmail: LEADER,
      dungeon,
      members: [{ userEmail: LEADER }, { userEmail: MATE }],
    });

    it('hands over the boss the run has reached', async () => {
      prisma.dungeonRun.findFirst.mockResolvedValue(activeRun(1));

      const prepared = await service.prepareNextFight({ userEmail: LEADER });

      expect(prepared?.boss.stage).toBe(2);
      expect(prepared?.emails).toEqual([LEADER, MATE]);
    });

    it('turns away someone who is not in a run', async () => {
      prisma.dungeonRun.findFirst.mockResolvedValue(null);

      expect(await service.prepareNextFight({ userEmail: LEADER })).toBeUndefined();
      expect(denial()).toBe('You are not inside a dungeon');
    });

    it('closes a run that survived midnight instead of running it', async () => {
      prisma.dungeonRun.findFirst.mockResolvedValue({ ...activeRun(1), startedAt: yesterday });
      prisma.dungeonRun.findUnique.mockResolvedValue({ id: 55, status: 'active', members: [] });

      expect(await service.prepareNextFight({ userEmail: LEADER })).toBeUndefined();
      expect(denial()).toBe('That run expired when the day rolled over');
    });

    it('has nothing left to fight once every boss is down', async () => {
      prisma.dungeonRun.findFirst.mockResolvedValue(activeRun(3));
      prisma.dungeonRun.findUnique.mockResolvedValue({
        id: 55,
        stage: 3,
        status: 'active',
        dungeon: { monsters: bosses },
        members: [],
      });

      expect(await service.prepareNextFight({ userEmail: LEADER })).toBeUndefined();
      expect(denial()).toBe('Forgotten Crypt is already cleared');
    });
  });

  describe('completeStage', () => {
    const runAt = (stage: number) => ({
      id: 55,
      stage,
      status: 'active',
      dungeon: { name: 'Forgotten Crypt', monsters: bosses },
      members: [{ userEmail: LEADER }, { userEmail: MATE }],
    });

    it('moves the run on without closing it while bosses remain', async () => {
      prisma.dungeonRun.findUnique.mockResolvedValue(runAt(0));

      await service.completeStage({ runId: 55 });

      expect(prisma.dungeonRun.update).toHaveBeenCalledWith({
        where: { id: 55 },
        data: { stage: 1, status: 'active', finishedAt: null },
      });
      expect(websocket.sendTextNotification).not.toHaveBeenCalled();
    });

    it('clears the run on the last boss and tells everyone who fought it', async () => {
      prisma.dungeonRun.findUnique.mockResolvedValue(runAt(2));

      await service.completeStage({ runId: 55 });

      expect(prisma.dungeonRun.update).toHaveBeenCalledWith({
        where: { id: 55 },
        data: { stage: 3, status: 'cleared', finishedAt: expect.any(Date) },
      });
      expect(websocket.sendTextNotification).toHaveBeenCalledTimes(2);
    });

    it('leaves a run that is already settled alone', async () => {
      prisma.dungeonRun.findUnique.mockResolvedValue({ ...runAt(3), status: 'cleared' });

      expect(await service.completeStage({ runId: 55 })).toBe(false);
      expect(prisma.dungeonRun.update).not.toHaveBeenCalled();
    });
  });

  describe('failRun', () => {
    it('ends the attempt', async () => {
      prisma.dungeonRun.findUnique.mockResolvedValue({ id: 55, status: 'active', members: [{ userEmail: LEADER }] });

      expect(await service.failRun({ runId: 55 })).toBe(true);
      expect(prisma.dungeonRun.update).toHaveBeenCalledWith({
        where: { id: 55 },
        data: { status: 'failed', finishedAt: expect.any(Date) },
      });
    });

    it('does not reopen a run that was already cleared', async () => {
      prisma.dungeonRun.findUnique.mockResolvedValue({ id: 55, status: 'cleared', members: [] });

      expect(await service.failRun({ runId: 55 })).toBe(false);
      expect(prisma.dungeonRun.update).not.toHaveBeenCalled();
    });
  });

  describe('campRestoreForRun', () => {
    it('brings a fallen member back up to the camp share', async () => {
      prisma.stats.findMany.mockResolvedValue([
        { userEmail: LEADER, health: 0, maxHealth: 1000, mana: 0, maxMana: 200 },
      ]);

      await service.campRestoreForRun({ emails: [LEADER] });

      expect(prisma.stats.update).toHaveBeenCalledWith({
        where: { userEmail: LEADER },
        data: { health: 300, mana: 60 },
      });
    });

    it('writes nothing for someone who came through in better shape', async () => {
      prisma.stats.findMany.mockResolvedValue([
        { userEmail: LEADER, health: 900, maxHealth: 1000, mana: 150, maxMana: 200 },
      ]);

      await service.campRestoreForRun({ emails: [LEADER] });
      expect(prisma.stats.update).not.toHaveBeenCalled();
    });
  });
});
