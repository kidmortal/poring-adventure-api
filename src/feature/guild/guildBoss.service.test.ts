import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

import { PrismaService } from 'src/core/prisma/prisma.service';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { NotificationService } from 'src/integrations/notification/notification.service';
import { GuildBossService } from './guildBoss.service';
import { GuildRepository } from './guild.repository';
import { GuildPermissions } from './guild.permissions';
import { GuildTaskService } from './guildTask.service';

/** The gates around starting a boss fight: guild only, one entry each per day. */
describe('Guild boss service', () => {
  const FIGHTER = 'fighter@test.com';
  const MATE = 'mate@test.com';
  const OUTSIDER = 'outsider@test.com';

  const yesterday = new Date(Date.now() - 1000 * 60 * 60 * 48);

  let service: GuildBossService;
  let prisma: any;
  let repository: {
    getUserGuildMember: jest.Mock;
    getGuild: jest.Mock;
    clearGuildCache: jest.Mock;
    notifyGuildWithUpdate: jest.Mock;
  };
  let websocket: { sendErrorNotification: jest.Mock; sendMessageToSocket: jest.Mock; sendTextNotification: jest.Mock };

  const standingBoss = {
    id: 7,
    guildId: 1,
    guildBossId: 2,
    difficulty: 'normal',
    maxHealth: 60000,
    health: 42000,
    attack: 32,
    boss: { id: 2, name: 'Baphomet', health: 20000, attack: 20, taskPoints: 100, tokens: 100 },
    damage: [],
  };

  beforeEach(async () => {
    prisma = {
      currentGuildBoss: { findUnique: jest.fn().mockResolvedValue(standingBoss) },
      guildMember: {
        findMany: jest.fn().mockResolvedValue([
          { userEmail: FIGHTER, guildId: 1, bossEntryUsedAt: yesterday, user: { name: 'Kidmortal' } },
          { userEmail: MATE, guildId: 1, bossEntryUsedAt: null, user: { name: 'Joseph' } },
        ]),
        updateMany: jest.fn().mockResolvedValue({}),
      },
    };
    repository = {
      getUserGuildMember: jest.fn().mockResolvedValue({ userEmail: FIGHTER, guildId: 1 }),
      getGuild: jest.fn().mockResolvedValue({ members: [] }),
      clearGuildCache: jest.fn(),
      notifyGuildWithUpdate: jest.fn(),
    };
    websocket = {
      sendErrorNotification: jest.fn(),
      sendMessageToSocket: jest.fn(),
      sendTextNotification: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GuildBossService,
        { provide: PrismaService, useValue: prisma },
        { provide: GuildRepository, useValue: repository },
        { provide: GuildPermissions, useValue: { requireMember: jest.fn() } },
        { provide: GuildTaskService, useValue: { addTaskPointsToGuild: jest.fn(), refreshGuild: jest.fn() } },
        { provide: WebsocketService, useValue: websocket },
        { provide: NotificationService, useValue: { sendPushNotificationToTag: jest.fn() } },
        { provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } },
      ],
    }).compile();

    service = module.get(GuildBossService);
  });

  describe('hasEntry', () => {
    it('is spent for the rest of the day', () => {
      expect(service.hasEntry({ bossEntryUsedAt: new Date() })).toBe(false);
    });

    it('comes back the next day', () => {
      expect(service.hasEntry({ bossEntryUsedAt: yesterday })).toBe(true);
    });

    it('is there for someone who has never fought', () => {
      expect(service.hasEntry({ bossEntryUsedAt: null })).toBe(true);
    });
  });

  describe('prepareFight', () => {
    it('lets a guild party in', async () => {
      const prepared = await service.prepareFight({ userEmail: FIGHTER, partyEmails: [FIGHTER, MATE] });
      expect(prepared?.guildId).toBe(1);
      expect(prepared?.boss.id).toBe(standingBoss.id);
    });

    it('turns away a party carrying someone from outside the guild', async () => {
      const prepared = await service.prepareFight({ userEmail: FIGHTER, partyEmails: [FIGHTER, OUTSIDER] });
      expect(prepared).toBeUndefined();
      expect(websocket.sendErrorNotification).toHaveBeenCalledWith(
        expect.objectContaining({ text: expect.stringContaining('in your guild') }),
      );
    });

    it('stops the whole party when one member has already fought today', async () => {
      prisma.guildMember.findMany.mockResolvedValue([
        { userEmail: FIGHTER, guildId: 1, bossEntryUsedAt: yesterday, user: { name: 'Kidmortal' } },
        { userEmail: MATE, guildId: 1, bossEntryUsedAt: new Date(), user: { name: 'Joseph' } },
      ]);

      const prepared = await service.prepareFight({ userEmail: FIGHTER, partyEmails: [FIGHTER, MATE] });
      expect(prepared).toBeUndefined();
      // Named, not emailed — the party knows each other by nickname.
      expect(websocket.sendErrorNotification).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Joseph has already fought the boss today' }),
      );
    });

    it('says "you" rather than naming the caller back at themselves', async () => {
      prisma.guildMember.findMany.mockResolvedValue([
        { userEmail: FIGHTER, guildId: 1, bossEntryUsedAt: new Date(), user: { name: 'Kidmortal' } },
      ]);

      await service.prepareFight({ userEmail: FIGHTER, partyEmails: [FIGHTER] });
      expect(websocket.sendErrorNotification).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'You have already fought the boss today' }),
      );
    });

    it('falls back to the email when the name is missing', async () => {
      prisma.guildMember.findMany.mockResolvedValue([
        { userEmail: FIGHTER, guildId: 1, bossEntryUsedAt: yesterday },
        { userEmail: MATE, guildId: 1, bossEntryUsedAt: new Date() },
      ]);

      await service.prepareFight({ userEmail: FIGHTER, partyEmails: [FIGHTER, MATE] });
      expect(websocket.sendErrorNotification).toHaveBeenCalledWith(
        expect.objectContaining({ text: `${MATE} has already fought the boss today` }),
      );
    });

    it('has nothing to fight without a boss standing', async () => {
      prisma.currentGuildBoss.findUnique.mockResolvedValue(null);

      const prepared = await service.prepareFight({ userEmail: FIGHTER, partyEmails: [FIGHTER] });
      expect(prepared).toBeUndefined();
    });

    it('has nothing to fight once the pool is empty', async () => {
      prisma.currentGuildBoss.findUnique.mockResolvedValue({ ...standingBoss, health: 0 });

      const prepared = await service.prepareFight({ userEmail: FIGHTER, partyEmails: [FIGHTER] });
      expect(prepared).toBeUndefined();
    });

    it('turns away someone with no guild', async () => {
      repository.getUserGuildMember.mockResolvedValue(null);

      const prepared = await service.prepareFight({ userEmail: FIGHTER, partyEmails: [FIGHTER] });
      expect(prepared).toBeUndefined();
    });
  });

  describe('consumeEntries', () => {
    it('spends the entry of everyone walking in', async () => {
      await service.consumeEntries({ guildId: 1, emails: [FIGHTER, MATE] });

      expect(prisma.guildMember.updateMany).toHaveBeenCalledWith({
        where: { userEmail: { in: [FIGHTER, MATE] } },
        data: { bossEntryUsedAt: expect.any(Date) },
      });
      expect(repository.clearGuildCache).toHaveBeenCalledWith({ guildId: 1 });
    });
  });
});
