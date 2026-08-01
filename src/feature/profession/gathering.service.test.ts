import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { InventoryService } from 'src/feature/items/inventory.service';
import { UserStaminaService } from 'src/feature/users/userStamina.service';
import { UsersService } from 'src/feature/users/users.service';
import { GatheringService } from './gathering.service';
import { ProfessionService } from './profession.service';

describe('Gathering Service', () => {
  let service: GatheringService;
  let prisma: PrismaService;
  let professions: { requireLearnedProfession: jest.Mock; addExperience: jest.Mock };
  let stamina: { consumeStamina: jest.Mock };
  let inventory: { addItemToInventory: jest.Mock };

  const node = {
    id: 1,
    name: 'Copper Vein',
    professionId: 2,
    requiredLevel: 1,
    staminaCost: 5,
    experience: 10,
    drops: [{ itemId: 7, chance: 100, minAmount: 2, maxAmount: 2 }],
  };

  beforeEach(async () => {
    professions = { requireLearnedProfession: jest.fn().mockResolvedValue({ level: 1 }), addExperience: jest.fn() };
    stamina = { consumeStamina: jest.fn().mockResolvedValue(true) };
    inventory = { addItemToInventory: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GatheringService,
        PrismaService,
        { provide: ProfessionService, useValue: professions },
        { provide: UserStaminaService, useValue: stamina },
        { provide: InventoryService, useValue: inventory },
        { provide: UsersService, useValue: { notifyUserUpdateWithProfile: jest.fn() } },
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    service = module.get<GatheringService>(GatheringService);
    prisma.$transaction = jest.fn().mockImplementation((callback) => callback(prisma));
  });

  afterEach(() => jest.restoreAllMocks());

  it('spends stamina, hands out the drops and credits the profession', async () => {
    prisma.gatheringNode.findUnique = jest.fn().mockResolvedValue(node);

    const result = await service.gather({ userEmail: 'test@test.com', nodeId: 1 });

    expect(stamina.consumeStamina).toHaveBeenCalledWith(expect.objectContaining({ amount: 5 }));
    expect(inventory.addItemToInventory).toHaveBeenCalledWith(expect.objectContaining({ itemId: 7, stack: 2 }));
    expect(professions.addExperience).toHaveBeenCalledWith(expect.objectContaining({ professionId: 2, amount: 10 }));
    expect(result.drops).toEqual([{ itemId: 7, amount: 2 }]);
  });

  it('refuses a node that does not exist', async () => {
    prisma.gatheringNode.findUnique = jest.fn().mockResolvedValue(null);

    await expect(service.gather({ userEmail: 'test@test.com', nodeId: 99 })).rejects.toThrow(
      'Gathering node does not exist',
    );
  });

  it('checks the profession before spending anything', async () => {
    prisma.gatheringNode.findUnique = jest.fn().mockResolvedValue(node);
    professions.requireLearnedProfession.mockRejectedValue(new Error('You have not learned this profession'));

    await expect(service.gather({ userEmail: 'test@test.com', nodeId: 1 })).rejects.toThrow(
      'You have not learned this profession',
    );
    expect(stamina.consumeStamina).not.toHaveBeenCalled();
    expect(inventory.addItemToInventory).not.toHaveBeenCalled();
  });

  it('still costs stamina and experience when every roll misses', async () => {
    prisma.gatheringNode.findUnique = jest
      .fn()
      .mockResolvedValue({ ...node, drops: [{ itemId: 7, chance: 10, minAmount: 1, maxAmount: 1 }] });
    jest.spyOn(Math, 'random').mockReturnValue(0.99);

    const result = await service.gather({ userEmail: 'test@test.com', nodeId: 1 });

    expect(result.drops).toEqual([]);
    expect(inventory.addItemToInventory).not.toHaveBeenCalled();
    expect(stamina.consumeStamina).toHaveBeenCalled();
    expect(professions.addExperience).toHaveBeenCalled();
  });
});
