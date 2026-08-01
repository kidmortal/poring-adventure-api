import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { InventoryService } from 'src/feature/items/inventory.service';
import { UserStaminaService } from 'src/feature/users/userStamina.service';
import { UsersService } from 'src/feature/users/users.service';
import { CraftingService } from './crafting.service';
import { ProfessionService } from './profession.service';

describe('Crafting Service', () => {
  let service: CraftingService;
  let prisma: PrismaService;
  let professions: { requireLearnedProfession: jest.Mock; addExperience: jest.Mock };
  let stamina: { consumeStamina: jest.Mock };
  let inventory: { addItemToInventory: jest.Mock; removeItemFromInventory: jest.Mock };

  const recipe = {
    id: 1,
    name: 'Healing Potion',
    professionId: 4,
    requiredLevel: 1,
    staminaCost: 5,
    experience: 15,
    itemId: 20,
    amount: 1,
    ingredients: [{ itemId: 7, amount: 2 }],
  };

  beforeEach(async () => {
    professions = { requireLearnedProfession: jest.fn().mockResolvedValue({ level: 1 }), addExperience: jest.fn() };
    stamina = { consumeStamina: jest.fn().mockResolvedValue(true) };
    inventory = { addItemToInventory: jest.fn().mockResolvedValue({}), removeItemFromInventory: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CraftingService,
        PrismaService,
        { provide: ProfessionService, useValue: professions },
        { provide: UserStaminaService, useValue: stamina },
        { provide: InventoryService, useValue: inventory },
        { provide: UsersService, useValue: { notifyUserUpdateWithProfile: jest.fn() } },
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    service = module.get<CraftingService>(CraftingService);
    prisma.$transaction = jest.fn().mockImplementation((callback) => callback(prisma));
  });

  it('consumes the ingredients and stamina, then hands over the result', async () => {
    prisma.recipe.findUnique = jest.fn().mockResolvedValue(recipe);
    prisma.inventoryItem.findMany = jest.fn().mockResolvedValue([{ id: 50, itemId: 7, stack: 5 }]);

    const result = await service.craft({ userEmail: 'test@test.com', recipeId: 1 });

    expect(inventory.removeItemFromInventory).toHaveBeenCalledWith(
      expect.objectContaining({ inventoryId: 50, stack: 2 }),
    );
    expect(inventory.addItemToInventory).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: 20, stack: 1, quality: expect.any(Number) }),
    );
    expect(stamina.consumeStamina).toHaveBeenCalledWith(expect.objectContaining({ amount: 5 }));
    expect(professions.addExperience).toHaveBeenCalledWith(expect.objectContaining({ professionId: 4, amount: 15 }));
    expect(result).toEqual(
      expect.objectContaining({ recipe: 'Healing Potion', amount: 1, experience: 15, quality: expect.any(Number) }),
    );
  });

  it('rolls the result quality against the crafter level', async () => {
    prisma.recipe.findUnique = jest.fn().mockResolvedValue(recipe);
    prisma.inventoryItem.findMany = jest.fn().mockResolvedValue([{ id: 50, itemId: 7, stack: 5 }]);
    professions.requireLearnedProfession.mockResolvedValue({ level: 20 });
    jest.spyOn(Math, 'random').mockReturnValue(0.999);

    const result = await service.craft({ userEmail: 'test@test.com', recipeId: 1 });

    expect(inventory.addItemToInventory).toHaveBeenCalledWith(expect.objectContaining({ quality: 5 }));
    expect(result.quality).toBe(5);
  });

  it('refuses a recipe that does not exist', async () => {
    prisma.recipe.findUnique = jest.fn().mockResolvedValue(null);

    await expect(service.craft({ userEmail: 'test@test.com', recipeId: 99 })).rejects.toThrow('Recipe does not exist');
  });

  it('spends nothing when an ingredient is missing', async () => {
    prisma.recipe.findUnique = jest.fn().mockResolvedValue(recipe);
    prisma.inventoryItem.findMany = jest.fn().mockResolvedValue([{ id: 50, itemId: 7, stack: 1 }]);

    await expect(service.craft({ userEmail: 'test@test.com', recipeId: 1 })).rejects.toThrow(
      'You are missing ingredients for this recipe',
    );
    expect(stamina.consumeStamina).not.toHaveBeenCalled();
    expect(inventory.removeItemFromInventory).not.toHaveBeenCalled();
  });

  it('ignores equipped, locked and listed stacks when looking for ingredients', async () => {
    prisma.recipe.findUnique = jest.fn().mockResolvedValue(recipe);
    prisma.inventoryItem.findMany = jest.fn().mockResolvedValue([{ id: 50, itemId: 7, stack: 5 }]);

    await service.craft({ userEmail: 'test@test.com', recipeId: 1 });

    expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ equipped: false, locked: false, marketListing: null }),
      }),
    );
  });
});
