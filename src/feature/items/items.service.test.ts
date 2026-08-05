import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { UsersService } from 'src/feature/users/users.service';
import { UserStatsService } from 'src/feature/users/userStats.service';
import { UserWalletService } from 'src/feature/users/userWallet.service';
import { Utils } from 'src/utilities/utils';

import { InventoryService } from './inventory.service';
import { enhancePrice } from './items.rules';
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
    item: { name: 'Bronze Sword', category: 'weapon', requiredLevel: 21 },
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
        expect.objectContaining({
          userEmail: USER,
          amount: enhancePrice({ enhancement: 3, requiredLevel: 21, quality: 1 }),
        }),
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

    it('refuses a copy that is already promised to a market listing', async () => {
      // Enhancing moves the item to a new stack, which deletes the row it left —
      // and the listing cascades with it. The sale would have vanished silently.
      inventory.getOneInventoryItem.mockResolvedValue({ ...ownedItem, marketListing: { stack: 1 } });

      const result = await service.enhanceItem({ userEmail: USER, inventoryId: 7 });

      expect(result).toBe(false);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(websocket.sendErrorNotification).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Cannot enhance an item that is listed on the market' }),
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

  describe('upgradeItem', () => {
    /** The item the roll is made on: a finished +5, still Common. */
    const readyToUpgrade = { ...ownedItem, enhancement: 5 };
    /** The spare copy off a monster, at whatever enhancement it happened to have. */
    const spare = { id: 8, stack: 1, enhancement: 0, marketListing: null };

    beforeEach(() => {
      inventory.getOneInventoryItem.mockResolvedValue(readyToUpgrade);
      prisma.inventoryItem.findMany = jest.fn().mockResolvedValue([spare]);
    });

    it('raises the rarity and puts the enhancement back to zero on a win', async () => {
      jest.spyOn(Utils, 'isSuccess').mockReturnValue(true);

      const result = await service.upgradeItem({ userEmail: USER, inventoryId: 7 });

      expect(inventory.addItemToInventory).toHaveBeenCalledWith(
        expect.objectContaining({ quality: 2, enhancement: 0 }),
      );
      expect(result).toMatchObject({ success: true, chance: 70, quality: 2, enhancement: 0 });
    });

    it('eats the duplicate and the +5 either way when the roll is lost', async () => {
      jest.spyOn(Utils, 'isSuccess').mockReturnValue(false);

      const result = await service.upgradeItem({ userEmail: USER, inventoryId: 7 });

      // The rarity did not move, but the enhancement is gone — that loss is the
      // price of the roll, and the spare is spent whichever way it lands.
      expect(inventory.addItemToInventory).toHaveBeenCalledWith(
        expect.objectContaining({ quality: 1, enhancement: 0 }),
      );
      expect(inventory.removeItemFromInventory).toHaveBeenCalledTimes(2);
      expect(result).toMatchObject({ success: false, quality: 1, previousEnhancement: 5 });
    });

    it('refuses an item that has not been enhanced far enough yet', async () => {
      inventory.getOneInventoryItem.mockResolvedValue({ ...ownedItem, enhancement: 4 });

      expect(await service.upgradeItem({ userEmail: USER, inventoryId: 7 })).toBe(false);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(websocket.sendErrorNotification).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Requires +5 before its rarity can be raised' }),
      );
    });

    it('refuses a copy that is already promised to a market listing', async () => {
      inventory.getOneInventoryItem.mockResolvedValue({ ...readyToUpgrade, marketListing: { stack: 1 } });

      expect(await service.upgradeItem({ userEmail: USER, inventoryId: 7 })).toBe(false);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(websocket.sendErrorNotification).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Cannot upgrade an item that is listed on the market' }),
      );
    });

    it('refuses a Legendary, which has nowhere left to go', async () => {
      inventory.getOneInventoryItem.mockResolvedValue({ ...readyToUpgrade, quality: 5 });

      expect(await service.upgradeItem({ userEmail: USER, inventoryId: 7 })).toBe(false);
      expect(websocket.sendErrorNotification).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'This item is already Legendary' }),
      );
    });

    it('refuses when the only spare is already promised to the market', async () => {
      prisma.inventoryItem.findMany = jest.fn().mockResolvedValue([{ ...spare, marketListing: { stack: 1 } }]);

      expect(await service.upgradeItem({ userEmail: USER, inventoryId: 7 })).toBe(false);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('will not eat the item it is upgrading when that is the only copy', async () => {
      // Two identical +5s merge into one row, so the target's own stack is only
      // fuel when it holds a second copy.
      prisma.inventoryItem.findMany = jest.fn().mockResolvedValue([{ id: 7, stack: 1, enhancement: 5 }]);
      expect(await service.upgradeItem({ userEmail: USER, inventoryId: 7 })).toBe(false);

      prisma.inventoryItem.findMany = jest.fn().mockResolvedValue([{ id: 7, stack: 2, enhancement: 5 }]);
      jest.spyOn(Utils, 'isSuccess').mockReturnValue(true);
      expect(await service.upgradeItem({ userEmail: USER, inventoryId: 7 })).toMatchObject({ success: true });
    });

    it('reaches for the least enhanced spare rather than the first one found', async () => {
      await service.upgradeItem({ userEmail: USER, inventoryId: 7 });

      expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { enhancement: 'asc' } }),
      );
      // And only ever a copy at the same rarity, unlocked and not being worn.
      expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ itemId: 42, quality: 1, equipped: false, locked: false }),
        }),
      );
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
