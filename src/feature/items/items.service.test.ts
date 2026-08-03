import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { UsersService } from 'src/feature/users/users.service';
import { UserStatsService } from 'src/feature/users/userStats.service';
import { UserWalletService } from 'src/feature/users/userWallet.service';
import { Utils } from 'src/utilities/utils';

import { InventoryService } from './inventory.service';
import { ItemsService } from './items.service';

describe('Items Service', () => {
  let service: ItemsService;
  let prisma: PrismaService;
  let inventory: {
    getOneInventoryItem: jest.Mock;
    addItemToInventory: jest.Mock;
    removeItemFromInventory: jest.Mock;
  };
  let wallet: { removeSilverFromUser: jest.Mock };
  let users: { notifyUserUpdateWithProfile: jest.Mock };
  let websocket: { sendErrorNotification: jest.Mock };
  /** Everything the transaction callback did, in order. */
  let insideTransaction: string[];

  const USER = 'player@test.com';
  const ownedItem = {
    id: 7,
    itemId: 42,
    userEmail: USER,
    stack: 1,
    equipped: false,
    quality: 1,
    enhancement: 2,
    item: { name: 'Bronze Sword', category: 'weapon' },
  };

  beforeEach(async () => {
    insideTransaction = [];
    inventory = {
      getOneInventoryItem: jest.fn().mockResolvedValue(ownedItem),
      addItemToInventory: jest.fn().mockImplementation(() => insideTransaction.push('add')),
      removeItemFromInventory: jest.fn().mockImplementation(() => insideTransaction.push('remove')),
    };
    wallet = { removeSilverFromUser: jest.fn().mockImplementation(() => insideTransaction.push('pay')) };
    users = { notifyUserUpdateWithProfile: jest.fn().mockImplementation(() => insideTransaction.push('notify')) };
    websocket = { sendErrorNotification: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ItemsService,
        PrismaService,
        { provide: InventoryService, useValue: inventory },
        { provide: UserWalletService, useValue: wallet },
        { provide: UsersService, useValue: users },
        { provide: UserStatsService, useValue: {} },
        { provide: WebsocketService, useValue: websocket },
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    service = module.get<ItemsService>(ItemsService);
    prisma.user.findUnique = jest.fn().mockResolvedValue({ silver: 100_000 });
    prisma.$transaction = jest.fn().mockImplementation(async (callback) => {
      insideTransaction.push('begin');
      const result = await callback(prisma);
      insideTransaction.push('commit');
      return result;
    });
  });

  afterEach(() => jest.restoreAllMocks());

  describe('enhanceItem', () => {
    it('keeps the profile read and push outside the transaction', async () => {
      jest.spyOn(Utils, 'isSuccess').mockReturnValue(true);

      await service.enhanceItem({ userEmail: USER, inventoryId: 7 });

      // The transaction spans the writes only; notifying happens after commit.
      expect(insideTransaction).toEqual(['begin', 'remove', 'add', 'pay', 'commit', 'notify']);
    });

    it('raises the enhancement and charges for it on a successful roll', async () => {
      jest.spyOn(Utils, 'isSuccess').mockReturnValue(true);

      const result = await service.enhanceItem({ userEmail: USER, inventoryId: 7 });

      expect(inventory.addItemToInventory).toHaveBeenCalledWith(expect.objectContaining({ enhancement: 3, stack: 1 }));
      expect(wallet.removeSilverFromUser).toHaveBeenCalledWith(
        expect.objectContaining({ userEmail: USER, amount: Utils.enhancePrice(3) }),
      );
      expect(result).toMatchObject({ item: 'Bronze Sword', enhancement: 3, success: true });
    });

    it('still charges but leaves the item alone on a failed roll', async () => {
      jest.spyOn(Utils, 'isSuccess').mockReturnValue(false);

      const result = await service.enhanceItem({ userEmail: USER, inventoryId: 7 });

      expect(inventory.addItemToInventory).not.toHaveBeenCalled();
      expect(inventory.removeItemFromInventory).not.toHaveBeenCalled();
      expect(wallet.removeSilverFromUser).toHaveBeenCalled();
      expect(result).toMatchObject({ enhancement: 2, success: false });
    });

    it('refuses without opening a transaction when the silver is short', async () => {
      prisma.user.findUnique = jest.fn().mockResolvedValue({ silver: 0 });

      const result = await service.enhanceItem({ userEmail: USER, inventoryId: 7 });

      expect(result).toBe(false);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(websocket.sendErrorNotification).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Not enough silver' }),
      );
    });

    it('refuses an equipped item before reading anything else', async () => {
      inventory.getOneInventoryItem.mockResolvedValue({ ...ownedItem, equipped: true });

      const result = await service.enhanceItem({ userEmail: USER, inventoryId: 7 });

      expect(result).toBe(false);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses anything that is not equipment, which has no stats to raise', async () => {
      inventory.getOneInventoryItem.mockResolvedValue({
        ...ownedItem,
        item: { name: 'Healing Potion', category: 'consumable' },
      });

      const result = await service.enhanceItem({ userEmail: USER, inventoryId: 7 });

      expect(result).toBe(false);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(websocket.sendErrorNotification).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Only equipment can be enhanced' }),
      );
    });

    it('takes a level back when a roll above the setback threshold fails', async () => {
      inventory.getOneInventoryItem.mockResolvedValue({ ...ownedItem, enhancement: 7 });
      jest.spyOn(Utils, 'isSuccess').mockReturnValue(false);

      const result = await service.enhanceItem({ userEmail: USER, inventoryId: 7 });

      expect(inventory.addItemToInventory).toHaveBeenCalledWith(expect.objectContaining({ enhancement: 6 }));
      expect(result).toMatchObject({ enhancement: 6, success: false, setback: true });
    });

    it('never drops below the floor, however unlucky the run', async () => {
      inventory.getOneInventoryItem.mockResolvedValue({ ...ownedItem, enhancement: 5 });
      jest.spyOn(Utils, 'isSuccess').mockReturnValue(false);

      const result = await service.enhanceItem({ userEmail: USER, inventoryId: 7 });

      expect(inventory.addItemToInventory).not.toHaveBeenCalled();
      expect(result).toMatchObject({ enhancement: 5, success: false, setback: false });
    });
  });

  describe('consumeItem', () => {
    const potion = {
      id: 9,
      itemId: 50,
      userEmail: USER,
      stack: 1,
      equipped: false,
      quality: 5,
      enhancement: 0,
      item: { name: 'Healing Potion', category: 'consumable', health: 50, mana: null, buff: null, partyWide: false },
    };

    beforeEach(() => {
      inventory.getOneInventoryItem.mockResolvedValue(potion);
    });

    it('scales what it restores by the quality it was crafted at', async () => {
      const stats = { incrementUserHealth: jest.fn(), incrementUserMana: jest.fn(), applyBuff: jest.fn() };
      (service as unknown as { userStats: typeof stats }).userStats = stats;

      const result = await service.consumeItem({ userEmail: USER, inventoryId: 9, stack: 1 });

      // Legendary is ×1.6, so the 50 on the item is worth 80 in the hand.
      expect(stats.incrementUserHealth).toHaveBeenCalledWith(expect.objectContaining({ amount: 80 }));
      expect(result).toMatchObject({ item: 'Healing Potion', health: 80, quality: 5 });
    });

    it('turns down anything that is not a consumable', async () => {
      inventory.getOneInventoryItem.mockResolvedValue(ownedItem);

      expect(await service.consumeItem({ userEmail: USER, inventoryId: 7, stack: 1 })).toBe(false);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
