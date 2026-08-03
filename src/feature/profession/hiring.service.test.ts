import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { InventoryService } from 'src/feature/items/inventory.service';
import { UserStaminaService } from 'src/feature/users/userStamina.service';
import { UserWalletService } from 'src/feature/users/userWallet.service';
import { UsersService } from 'src/feature/users/users.service';
import { HiringService } from './hiring.service';
import { ProfessionService } from './profession.service';
import { ServiceOfferService } from './serviceOffer.service';
import { NotificationService } from 'src/feature/mail/notification.service';

describe('Hiring Service', () => {
  let service: HiringService;
  let prisma: PrismaService;
  let offers: { requireOffer: jest.Mock };
  let professions: { requireLearnedProfession: jest.Mock; getUserProfession: jest.Mock; addExperience: jest.Mock };
  let stamina: { consumeStamina: jest.Mock };
  let notifications: { notify: jest.Mock; push: jest.Mock };
  let wallet: { transferSilverFromUserToUser: jest.Mock; removeSilverFromUser: jest.Mock };
  let inventory: {
    addItemToInventory: jest.Mock;
    removeItemFromInventory: jest.Mock;
    getOneInventoryItem: jest.Mock;
  };

  const HIRER = 'hirer@test.com';
  const CRAFTER = 'crafter@test.com';

  const offer = {
    id: 1,
    crafterEmail: CRAFTER,
    professionId: 4,
    pricePerStamina: 50,
    crafting: true,
    enhancing: true,
    profession: { id: 4, name: 'Blacksmithing', canEnhance: true },
    crafter: { name: 'Smithy', email: CRAFTER },
  };

  const recipe = {
    id: 3,
    name: 'Iron Sword',
    professionId: 4,
    requiredLevel: 3,
    staminaCost: 10,
    experience: 40,
    itemId: 9,
    amount: 1,
    ingredients: [{ itemId: 7, amount: 4 }],
  };

  beforeEach(async () => {
    offers = { requireOffer: jest.fn().mockResolvedValue(offer) };
    professions = {
      requireLearnedProfession: jest.fn().mockResolvedValue({ level: 5, profession: { name: 'Blacksmithing' } }),
      getUserProfession: jest.fn().mockResolvedValue({
        professionId: 4,
        level: 5,
        profession: { name: 'Blacksmithing', canEnhance: true },
      }),
      addExperience: jest.fn(),
    };
    stamina = { consumeStamina: jest.fn().mockResolvedValue(true) };
    notifications = { notify: jest.fn(), push: jest.fn() };
    wallet = { transferSilverFromUserToUser: jest.fn(), removeSilverFromUser: jest.fn() };
    inventory = {
      addItemToInventory: jest.fn().mockResolvedValue({}),
      removeItemFromInventory: jest.fn().mockResolvedValue({}),
      getOneInventoryItem: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HiringService,
        PrismaService,
        { provide: ServiceOfferService, useValue: offers },
        { provide: ProfessionService, useValue: professions },
        { provide: UserStaminaService, useValue: stamina },
        { provide: UserWalletService, useValue: wallet },
        { provide: InventoryService, useValue: inventory },
        { provide: UsersService, useValue: { notifyUserUpdateWithProfile: jest.fn() } },
        { provide: NotificationService, useValue: notifications },
        {
          provide: WebsocketService,
          useValue: { sendTextNotification: jest.fn(), sendErrorNotification: jest.fn() },
        },
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    service = module.get<HiringService>(HiringService);
    prisma.$transaction = jest.fn().mockImplementation((callback) => callback(prisma));
    prisma.user.findUnique = jest.fn().mockResolvedValue({ email: HIRER, name: 'Rich Guy', silver: 100000 });
  });

  afterEach(() => jest.restoreAllMocks());

  describe('hireCraft', () => {
    beforeEach(() => {
      prisma.recipe.findUnique = jest.fn().mockResolvedValue(recipe);
      prisma.inventoryItem.findMany = jest.fn().mockResolvedValue([{ id: 20, itemId: 7, stack: 10 }]);
    });

    it('splits the job: hirer pays and keeps the item, crafter spends stamina and keeps the experience', async () => {
      const result = await service.hireCraft({ hirerEmail: HIRER, offerId: 1, recipeId: 3 });

      expect(stamina.consumeStamina).toHaveBeenCalledWith(expect.objectContaining({ userEmail: CRAFTER, amount: 10 }));
      expect(inventory.removeItemFromInventory).toHaveBeenCalledWith(
        expect.objectContaining({ userEmail: HIRER, inventoryId: 20, stack: 4 }),
      );
      expect(inventory.addItemToInventory).toHaveBeenCalledWith(
        expect.objectContaining({ userEmail: HIRER, itemId: 9, stack: 1, quality: expect.any(Number) }),
      );
      expect(professions.addExperience).toHaveBeenCalledWith(
        expect.objectContaining({ userEmail: CRAFTER, professionId: 4, amount: 40 }),
      );
      // 10 stamina at 50 silver each.
      expect(wallet.transferSilverFromUserToUser).toHaveBeenCalledWith(
        expect.objectContaining({ senderEmail: HIRER, receiverEmail: CRAFTER, amount: 500 }),
      );
      expect(result).toEqual(expect.objectContaining({ recipe: 'Iron Sword', fee: 500, crafter: 'Smithy' }));
      // The crafter can be offline, so what they earned is logged for later.
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({ userEmail: CRAFTER, type: 'hired_craft', silver: 500, experience: 40 }),
      );
    });

    it('rolls the result quality against the hired crafter level, not yours', async () => {
      professions.requireLearnedProfession.mockResolvedValue({ level: 20, profession: { name: 'Blacksmithing' } });
      jest.spyOn(Math, 'random').mockReturnValue(0.999);

      const result = await service.hireCraft({ hirerEmail: HIRER, offerId: 1, recipeId: 3 });

      expect(result).toEqual(expect.objectContaining({ quality: 5, crafterLevel: 20 }));
    });

    it('refuses a recipe the crafter does not practice', async () => {
      prisma.recipe.findUnique = jest.fn().mockResolvedValue({ ...recipe, professionId: 5 });

      await expect(service.hireCraft({ hirerEmail: HIRER, offerId: 1, recipeId: 3 })).rejects.toThrow(
        'Smithy does not craft that',
      );
      expect(stamina.consumeStamina).not.toHaveBeenCalled();
    });

    it('holds the crafter to the recipe level, so hiring is not a way around it', async () => {
      professions.requireLearnedProfession.mockRejectedValue(new Error('Requires Blacksmithing level 3'));

      await expect(service.hireCraft({ hirerEmail: HIRER, offerId: 1, recipeId: 3 })).rejects.toThrow(
        'Requires Blacksmithing level 3',
      );
      expect(wallet.transferSilverFromUserToUser).not.toHaveBeenCalled();
    });

    it('spends nothing when the hirer is missing ingredients', async () => {
      prisma.inventoryItem.findMany = jest.fn().mockResolvedValue([{ id: 20, itemId: 7, stack: 1 }]);

      await expect(service.hireCraft({ hirerEmail: HIRER, offerId: 1, recipeId: 3 })).rejects.toThrow(
        'You are missing ingredients for this recipe',
      );
      expect(stamina.consumeStamina).not.toHaveBeenCalled();
      expect(wallet.transferSilverFromUserToUser).not.toHaveBeenCalled();
    });

    it('refuses a hirer who cannot pay the fee', async () => {
      prisma.user.findUnique = jest.fn().mockResolvedValue({ email: HIRER, silver: 499 });

      await expect(service.hireCraft({ hirerEmail: HIRER, offerId: 1, recipeId: 3 })).rejects.toThrow(
        'You are too poor for that',
      );
      expect(stamina.consumeStamina).not.toHaveBeenCalled();
    });

    it('refuses to hire yourself', async () => {
      await expect(service.hireCraft({ hirerEmail: CRAFTER, offerId: 1, recipeId: 3 })).rejects.toThrow(
        'You do not need to hire yourself',
      );
    });
  });

  describe('hireEnhance', () => {
    beforeEach(() => {
      inventory.getOneInventoryItem.mockResolvedValue({
        id: 30,
        itemId: 9,
        quality: 1,
        enhancement: 0,
        equipped: false,
        item: { name: 'Iron Sword', category: 'weapon' },
      });
    });

    it('charges the forge price and the smith fee, and upgrades the item on a success', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0);

      const result = await service.hireEnhance({ hirerEmail: HIRER, offerId: 1, inventoryId: 30 });

      expect(stamina.consumeStamina).toHaveBeenCalledWith(expect.objectContaining({ userEmail: CRAFTER, amount: 10 }));
      // Forge price is burned, the 10 stamina fee goes to the smith.
      expect(wallet.removeSilverFromUser).toHaveBeenCalledWith(expect.objectContaining({ userEmail: HIRER }));
      expect(wallet.transferSilverFromUserToUser).toHaveBeenCalledWith(
        expect.objectContaining({ senderEmail: HIRER, receiverEmail: CRAFTER, amount: 500 }),
      );
      expect(inventory.addItemToInventory).toHaveBeenCalledWith(
        expect.objectContaining({ userEmail: HIRER, itemId: 9, enhancement: 1 }),
      );
      expect(result).toEqual(expect.objectContaining({ success: true, enhancement: 1, blacksmithLevel: 5 }));
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({ userEmail: CRAFTER, type: 'hired_enhance', silver: 500, experience: 20 }),
      );
    });

    it('still bills both sides when the roll fails, leaving the item alone', async () => {
      inventory.getOneInventoryItem.mockResolvedValue({
        id: 30,
        itemId: 9,
        quality: 1,
        enhancement: 8,
        equipped: false,
        item: { name: 'Iron Sword', category: 'weapon' },
      });
      jest.spyOn(Math, 'random').mockReturnValue(0.99);

      const result = await service.hireEnhance({ hirerEmail: HIRER, offerId: 1, inventoryId: 30 });

      expect(result.success).toBe(false);
      // Past the setback threshold a failure costs a level, so the item comes
      // back off the forge at +7 rather than untouched at +8.
      expect(result.enhancement).toBe(7);
      expect(result.setback).toBe(true);
      expect(inventory.addItemToInventory).toHaveBeenCalledWith(expect.objectContaining({ enhancement: 7 }));
      expect(wallet.transferSilverFromUserToUser).toHaveBeenCalled();
      // Two experience per stamina point the job costs the smith.
      expect(professions.addExperience).toHaveBeenCalledWith(
        expect.objectContaining({ userEmail: CRAFTER, professionId: 4, amount: 20 }),
      );
    });

    it('rolls better for a higher level blacksmith', async () => {
      professions.requireLearnedProfession.mockResolvedValue({ level: 10, profession: { name: 'Blacksmithing' } });
      inventory.getOneInventoryItem.mockResolvedValue({
        id: 30,
        itemId: 9,
        quality: 1,
        enhancement: 3,
        equipped: false,
        item: { name: 'Iron Sword', category: 'weapon' },
      });

      const result = await service.hireEnhance({ hirerEmail: HIRER, offerId: 1, inventoryId: 30 });

      // Base chance for a +4 attempt is 66; a level 10 smith adds a full tenth
      // of it per level, which the cap trims to certainty at most.
      expect(result.baseChance).toBe(66);
      expect(result.chance).toBe(100);
    });

    it('refuses an equipped item', async () => {
      inventory.getOneInventoryItem.mockResolvedValue({
        id: 30,
        itemId: 9,
        quality: 1,
        enhancement: 0,
        equipped: true,
        item: { name: 'Iron Sword', category: 'weapon' },
      });

      await expect(service.hireEnhance({ hirerEmail: HIRER, offerId: 1, inventoryId: 30 })).rejects.toThrow(
        'Cannot enhance equipped item',
      );
      expect(stamina.consumeStamina).not.toHaveBeenCalled();
    });

    it('refuses a hirer who cannot cover the forge price and the fee', async () => {
      prisma.user.findUnique = jest.fn().mockResolvedValue({ email: HIRER, silver: 500 });

      await expect(service.hireEnhance({ hirerEmail: HIRER, offerId: 1, inventoryId: 30 })).rejects.toThrow(
        'You are too poor for that',
      );
      expect(stamina.consumeStamina).not.toHaveBeenCalled();
    });
  });

  describe('selfAssistedEnhance', () => {
    beforeEach(() => {
      inventory.getOneInventoryItem.mockResolvedValue({
        id: 30,
        itemId: 9,
        quality: 1,
        enhancement: 0,
        equipped: false,
        item: { name: 'Iron Sword', category: 'weapon' },
      });
      prisma.user.findUnique = jest.fn().mockResolvedValue({ email: CRAFTER, silver: 100000 });
    });

    it('spends the smith own stamina and applies their own level bonus, with no fee', async () => {
      const result = await service.selfAssistedEnhance({ userEmail: CRAFTER, inventoryId: 30 });

      expect(stamina.consumeStamina).toHaveBeenCalledWith(expect.objectContaining({ userEmail: CRAFTER, amount: 10 }));
      expect(wallet.transferSilverFromUserToUser).not.toHaveBeenCalled();
      expect(wallet.removeSilverFromUser).toHaveBeenCalledWith(expect.objectContaining({ userEmail: CRAFTER }));
      expect(professions.addExperience).toHaveBeenCalledWith(
        expect.objectContaining({ userEmail: CRAFTER, professionId: 4, amount: 20 }),
      );
      // Base 100 for a +1 attempt, so a level 5 smith adds nothing on top.
      expect(result).toEqual(expect.objectContaining({ chance: 100, fee: 0, blacksmithLevel: 5 }));
    });

    it('rolls better than doing it without the trade', async () => {
      inventory.getOneInventoryItem.mockResolvedValue({
        id: 30,
        itemId: 9,
        quality: 1,
        enhancement: 3,
        equipped: false,
        item: { name: 'Iron Sword', category: 'weapon' },
      });

      const result = await service.selfAssistedEnhance({ userEmail: CRAFTER, inventoryId: 30 });

      // Base 66 for a +4 attempt, plus a tenth of it per smith level.
      expect(result.baseChance).toBe(66);
      expect(result.chance).toBe(99);
    });

    it('refuses anyone whose profession cannot enhance', async () => {
      professions.getUserProfession.mockResolvedValue({
        professionId: 5,
        level: 3,
        profession: { name: 'Cooking', canEnhance: false },
      });

      await expect(service.selfAssistedEnhance({ userEmail: CRAFTER, inventoryId: 30 })).rejects.toThrow(
        'Only a blacksmith can do that',
      );
      expect(stamina.consumeStamina).not.toHaveBeenCalled();
    });

    it('refuses an equipped item', async () => {
      inventory.getOneInventoryItem.mockResolvedValue({
        id: 30,
        itemId: 9,
        quality: 1,
        enhancement: 0,
        equipped: true,
        item: { name: 'Iron Sword', category: 'weapon' },
      });

      await expect(service.selfAssistedEnhance({ userEmail: CRAFTER, inventoryId: 30 })).rejects.toThrow(
        'Cannot enhance equipped item',
      );
    });
  });
});
