import { Test, TestingModule } from '@nestjs/testing';
import { CraftingService } from './crafting.service';
import { GatheringService } from './gathering.service';
import { ProfessionGateway } from './profession.gateway';
import { ProfessionService } from './profession.service';

const socket = { handshake: { auth: { email: 'auth@email.com' } } } as any;

describe('Profession Gateway', () => {
  let gateway: ProfessionGateway;
  let professions: { learnProfession: jest.Mock; getUserProfessions: jest.Mock; getAllProfessions: jest.Mock };
  let gathering: { gather: jest.Mock; getAllNodes: jest.Mock };
  let crafting: { craft: jest.Mock; getAllRecipes: jest.Mock };

  beforeEach(async () => {
    professions = { learnProfession: jest.fn(), getUserProfessions: jest.fn(), getAllProfessions: jest.fn() };
    gathering = { gather: jest.fn(), getAllNodes: jest.fn() };
    crafting = { craft: jest.fn(), getAllRecipes: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfessionGateway,
        { provide: ProfessionService, useValue: professions },
        { provide: GatheringService, useValue: gathering },
        { provide: CraftingService, useValue: crafting },
      ],
    }).compile();

    gateway = module.get<ProfessionGateway>(ProfessionGateway);
  });

  it('learns a profession for the user on the handshake', async () => {
    await gateway.learnProfession({ professionId: 3 }, socket);

    expect(professions.learnProfession).toHaveBeenCalledWith({ userEmail: 'auth@email.com', professionId: 3 });
  });

  it('gathers as the user on the handshake', async () => {
    await gateway.gather({ nodeId: 2 }, socket);

    expect(gathering.gather).toHaveBeenCalledWith({ userEmail: 'auth@email.com', nodeId: 2 });
  });

  it('crafts as the user on the handshake', async () => {
    await gateway.craft({ recipeId: 4 }, socket);

    expect(crafting.craft).toHaveBeenCalledWith({ userEmail: 'auth@email.com', recipeId: 4 });
  });

  it('lists the content every client needs to render the trades', async () => {
    await gateway.getAllProfessions();
    await gateway.getGatheringNodes();
    await gateway.getRecipes();

    expect(professions.getAllProfessions).toHaveBeenCalled();
    expect(gathering.getAllNodes).toHaveBeenCalled();
    expect(crafting.getAllRecipes).toHaveBeenCalled();
  });
});
