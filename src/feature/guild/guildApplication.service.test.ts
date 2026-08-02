import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from 'src/core/prisma/prisma.service';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { NotificationService } from 'src/integrations/notification/notification.service';
import { UsersService } from 'src/feature/users/users.service';
import { GuildApplicationService } from './guildApplication.service';
import { GuildRepository } from './guild.repository';
import { GuildPermissions } from './guild.permissions';

describe('Guild application service', () => {
  const OFFICER = 'officer@test.com';
  const APPLICANT = 'applicant@test.com';

  let service: GuildApplicationService;
  let prisma: any;
  let tx: any;
  let notifications: { sendPushNotificationToUser: jest.Mock; addTagToSubscription: jest.Mock };
  let userService: { notifyUserUpdateWithProfile: jest.Mock };
  let websocket: { sendTextNotification: jest.Mock; sendErrorNotification: jest.Mock };

  const application = {
    id: 5,
    userEmail: APPLICANT,
    guildId: 1,
    guild: { id: 1, name: 'Mana' },
  };

  beforeEach(async () => {
    tx = {
      guildApplication: { deleteMany: jest.fn().mockResolvedValue({}) },
      guildMember: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      guildApplication: {
        findUnique: jest.fn().mockResolvedValue(application),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue(application),
      },
      // Records what ran inside the transaction, so the test can assert on it.
      $transaction: jest.fn(async (fn: any) => fn(tx)),
    };
    notifications = { sendPushNotificationToUser: jest.fn(), addTagToSubscription: jest.fn() };
    userService = { notifyUserUpdateWithProfile: jest.fn() };
    websocket = { sendTextNotification: jest.fn(), sendErrorNotification: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GuildApplicationService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: GuildRepository,
          useValue: { clearGuildCache: jest.fn(), notifyGuildWithUpdate: jest.fn() },
        },
        {
          provide: GuildPermissions,
          useValue: { requireMember: jest.fn().mockResolvedValue({ userEmail: OFFICER, guildId: 1 }) },
        },
        { provide: WebsocketService, useValue: websocket },
        { provide: NotificationService, useValue: notifications },
        { provide: UsersService, useValue: userService },
      ],
    }).compile();

    service = module.get(GuildApplicationService);
  });

  describe('acceptGuildApplication', () => {
    it('takes the applicant in', async () => {
      const accepted = await service.acceptGuildApplication({ userEmail: OFFICER, applicationId: 5 });

      expect(accepted).toBe(true);
      expect(tx.guildMember.create).toHaveBeenCalledWith({ data: { guildId: 1, userEmail: APPLICANT } });
      // Joining one guild withdraws the applications open elsewhere.
      expect(tx.guildApplication.deleteMany).toHaveBeenCalledWith({ where: { userEmail: APPLICANT } });
    });

    it('holds nothing but the writes in the transaction', async () => {
      await service.acceptGuildApplication({ userEmail: OFFICER, applicationId: 5 });

      // The push notification service and the profile re-read are what used to
      // stall the transaction past its budget.
      expect(notifications.sendPushNotificationToUser).toHaveBeenCalled();
      expect(userService.notifyUserUpdateWithProfile).toHaveBeenCalledWith({ email: APPLICANT });

      const [transactionCall] = prisma.$transaction.mock.invocationCallOrder;
      const [pushCall] = notifications.sendPushNotificationToUser.mock.invocationCallOrder;
      const [profileCall] = userService.notifyUserUpdateWithProfile.mock.invocationCallOrder;
      expect(pushCall).toBeGreaterThan(transactionCall);
      expect(profileCall).toBeGreaterThan(transactionCall);
    });

    it('reads the application before opening the transaction', async () => {
      await service.acceptGuildApplication({ userEmail: OFFICER, applicationId: 5 });

      const [readCall] = prisma.guildApplication.findUnique.mock.invocationCallOrder;
      const [transactionCall] = prisma.$transaction.mock.invocationCallOrder;
      expect(readCall).toBeLessThan(transactionCall);
    });

    it('refuses an application belonging to another guild', async () => {
      prisma.guildApplication.findUnique.mockResolvedValue({ ...application, guildId: 99 });

      const accepted = await service.acceptGuildApplication({ userEmail: OFFICER, applicationId: 5 });

      expect(accepted).toBe(false);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('says so when the application is already gone', async () => {
      prisma.guildApplication.findUnique.mockResolvedValue(null);

      const accepted = await service.acceptGuildApplication({ userEmail: OFFICER, applicationId: 5 });

      expect(accepted).toBe(false);
      expect(websocket.sendErrorNotification).toHaveBeenCalled();
    });
  });
});
