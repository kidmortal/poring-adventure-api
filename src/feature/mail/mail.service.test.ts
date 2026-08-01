import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { InventoryService } from 'src/feature/items/inventory.service';
import { UserWalletService } from 'src/feature/users/userWallet.service';
import { UsersService } from 'src/feature/users/users.service';
import { MailService } from './mail.service';

describe('Mail Service', () => {
  let service: MailService;
  let prisma: PrismaService;
  let wallet: { removeSilverFromUser: jest.Mock };
  let inventory: { removeItemFromInventory: jest.Mock };

  const SENDER = 'sender@test.com';
  const RECEIVER = 'receiver@test.com';

  const ownedItem = {
    id: 5,
    itemId: 9,
    stack: 10,
    equipped: false,
    locked: false,
    marketListing: null,
  };

  beforeEach(async () => {
    wallet = { removeSilverFromUser: jest.fn() };
    inventory = { removeItemFromInventory: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        PrismaService,
        { provide: UserWalletService, useValue: wallet },
        { provide: InventoryService, useValue: inventory },
        { provide: UsersService, useValue: { notifyUserUpdateWithProfile: jest.fn() } },
        { provide: WebsocketService, useValue: { sendMessageToSocket: jest.fn() } },
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    service = module.get<MailService>(MailService);
    prisma.$transaction = jest.fn().mockImplementation((callback) => callback(prisma));
    prisma.mail.create = jest.fn().mockResolvedValue({});
    prisma.mail.findMany = jest.fn().mockResolvedValue([]);
    prisma.inventoryItem.findUnique = jest.fn().mockResolvedValue(ownedItem);
    prisma.user.findUnique = jest
      .fn()
      .mockImplementation(({ where }) =>
        Promise.resolve(
          where.email === SENDER ? { email: SENDER, name: 'Giver', silver: 1000 } : { email: RECEIVER, name: 'Taker' },
        ),
      );
  });

  describe('sendGift', () => {
    it('moves exactly what was put in, with nothing skimmed', async () => {
      await service.sendGift({
        senderEmail: SENDER,
        receiverEmail: RECEIVER,
        silver: 300,
        inventoryId: 5,
        stack: 2,
        message: 'for the road',
      });

      expect(wallet.removeSilverFromUser).toHaveBeenCalledWith(
        expect.objectContaining({ userEmail: SENDER, amount: 300 }),
      );
      expect(inventory.removeItemFromInventory).toHaveBeenCalledWith(
        expect.objectContaining({ userEmail: SENDER, inventoryId: 5, stack: 2 }),
      );
      expect(prisma.mail.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userEmail: RECEIVER,
          sender: 'Giver',
          content: 'for the road',
          silver: 300,
          itemId: 9,
          itemStack: 2,
        }),
      });
    });

    it('names the sender when no message is written', async () => {
      await service.sendGift({ senderEmail: SENDER, receiverEmail: RECEIVER, silver: 10 });

      expect(prisma.mail.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ content: 'A gift from Giver' }),
      });
    });

    it('refuses an empty gift', async () => {
      await expect(service.sendGift({ senderEmail: SENDER, receiverEmail: RECEIVER })).rejects.toThrow(
        'Put something in the gift first',
      );
    });

    it('refuses to gift yourself', async () => {
      await expect(service.sendGift({ senderEmail: SENDER, receiverEmail: SENDER, silver: 10 })).rejects.toThrow(
        'You cannot gift yourself',
      );
    });

    it('refuses silver the sender does not have', async () => {
      await expect(service.sendGift({ senderEmail: SENDER, receiverEmail: RECEIVER, silver: 5000 })).rejects.toThrow(
        'You are too poor for that',
      );
      expect(prisma.mail.create).not.toHaveBeenCalled();
    });

    it('refuses gear that is equipped, locked or on sale', async () => {
      prisma.inventoryItem.findUnique = jest.fn().mockResolvedValue({ ...ownedItem, equipped: true });

      await expect(
        service.sendGift({ senderEmail: SENDER, receiverEmail: RECEIVER, inventoryId: 5, stack: 1 }),
      ).rejects.toThrow('That item is not free to give');
    });

    it('refuses more of an item than the sender owns', async () => {
      await expect(
        service.sendGift({ senderEmail: SENDER, receiverEmail: RECEIVER, inventoryId: 5, stack: 99 }),
      ).rejects.toThrow('You only have 10 of those');
    });
  });
});
