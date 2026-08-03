import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from 'src/feature/users/users.service';
import { CraftingService } from './crafting.service';
import { GatheringService } from './gathering.service';
import { ProfessionGateway } from './profession.gateway';
import { ProfessionService } from './profession.service';
import { ServiceOfferService } from './serviceOffer.service';
import { HiringService } from './hiring.service';
import { CommissionService } from './commission.service';

const socket = { handshake: { auth: { email: 'auth@email.com' } } } as any;

describe('Profession Gateway', () => {
  let gateway: ProfessionGateway;
  let professions: { learnProfession: jest.Mock; getUserProfessions: jest.Mock; getAllProfessions: jest.Mock };
  let gathering: { gather: jest.Mock; getAllNodes: jest.Mock };
  let crafting: { craft: jest.Mock; getAllRecipes: jest.Mock };
  let offers: { getAllOffers: jest.Mock; getUserOffer: jest.Mock; publishOffer: jest.Mock; removeOffer: jest.Mock };
  let hiring: { hireCraft: jest.Mock; hireEnhance: jest.Mock };
  let commissions: { getBoard: jest.Mock; deliver: jest.Mock };
  let users: { notifyUserUpdateWithProfile: jest.Mock };

  beforeEach(async () => {
    professions = { learnProfession: jest.fn(), getUserProfessions: jest.fn(), getAllProfessions: jest.fn() };
    gathering = { gather: jest.fn(), getAllNodes: jest.fn() };
    crafting = { craft: jest.fn(), getAllRecipes: jest.fn() };
    offers = { getAllOffers: jest.fn(), getUserOffer: jest.fn(), publishOffer: jest.fn(), removeOffer: jest.fn() };
    hiring = { hireCraft: jest.fn(), hireEnhance: jest.fn() };
    commissions = { getBoard: jest.fn(), deliver: jest.fn() };
    users = { notifyUserUpdateWithProfile: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfessionGateway,
        { provide: ProfessionService, useValue: professions },
        { provide: GatheringService, useValue: gathering },
        { provide: CraftingService, useValue: crafting },
        { provide: ServiceOfferService, useValue: offers },
        { provide: HiringService, useValue: hiring },
        { provide: CommissionService, useValue: commissions },
        { provide: UsersService, useValue: users },
      ],
    }).compile();

    gateway = module.get<ProfessionGateway>(ProfessionGateway);
  });

  it('learns a profession and pushes the profile carrying it', async () => {
    await gateway.learnProfession({ professionId: 3 }, socket);

    expect(professions.learnProfession).toHaveBeenCalledWith({ userEmail: 'auth@email.com', professionId: 3 });
    expect(users.notifyUserUpdateWithProfile).toHaveBeenCalledWith({ email: 'auth@email.com' });
  });

  it('gathers as the user on the handshake', async () => {
    await gateway.gather({ nodeId: 2 }, socket);

    expect(gathering.gather).toHaveBeenCalledWith({ userEmail: 'auth@email.com', nodeId: 2 });
  });

  it('crafts as the user on the handshake', async () => {
    await gateway.craft({ recipeId: 4 }, socket);

    expect(crafting.craft).toHaveBeenCalledWith({ userEmail: 'auth@email.com', recipeId: 4 });
  });

  it('hires as the user on the handshake, never as the crafter being hired', async () => {
    await gateway.hireCraft({ offerId: 1, recipeId: 4 }, socket);
    await gateway.hireEnhance({ offerId: 1, inventoryId: 30 }, socket);

    expect(hiring.hireCraft).toHaveBeenCalledWith({ hirerEmail: 'auth@email.com', offerId: 1, recipeId: 4 });
    expect(hiring.hireEnhance).toHaveBeenCalledWith({ hirerEmail: 'auth@email.com', offerId: 1, inventoryId: 30 });
  });

  it('publishes the offer for the user on the handshake', async () => {
    await gateway.publishServiceOffer({ pricePerStamina: 50, crafting: true, enhancing: false }, socket);

    expect(offers.publishOffer).toHaveBeenCalledWith({
      crafterEmail: 'auth@email.com',
      pricePerStamina: 50,
      crafting: true,
      enhancing: false,
    });
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
