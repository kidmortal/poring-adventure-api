import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { ServiceOfferService } from './serviceOffer.service';

describe('Service Offer Service', () => {
  let service: ServiceOfferService;
  let prisma: PrismaService;

  const CRAFTER = 'crafter@test.com';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ServiceOfferService, PrismaService],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    service = module.get<ServiceOfferService>(ServiceOfferService);
    prisma.serviceOffer.upsert = jest.fn().mockResolvedValue({});
  });

  describe('publishOffer', () => {
    it('publishes under whichever profession the crafter currently practices', async () => {
      prisma.userProfession.findFirst = jest.fn().mockResolvedValue({
        professionId: 4,
        profession: { name: 'Blacksmithing', kind: 'crafting', canEnhance: true },
      });

      await service.publishOffer({ crafterEmail: CRAFTER, pricePerStamina: 50, crafting: true, enhancing: true });

      expect(prisma.serviceOffer.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { crafterEmail: CRAFTER },
          create: expect.objectContaining({ professionId: 4, pricePerStamina: 50, enhancing: true }),
        }),
      );
    });

    it('refuses to sell enhancing from a profession that cannot enhance', async () => {
      prisma.userProfession.findFirst = jest.fn().mockResolvedValue({
        professionId: 5,
        profession: { name: 'Cooking', kind: 'crafting', canEnhance: false },
      });

      await expect(
        service.publishOffer({ crafterEmail: CRAFTER, pricePerStamina: 50, crafting: true, enhancing: true }),
      ).rejects.toThrow('Cooking cannot enhance items for others');
      expect(prisma.serviceOffer.upsert).not.toHaveBeenCalled();
    });

    it('refuses a gathering trade, which nobody can be hired for', async () => {
      prisma.userProfession.findFirst = jest.fn().mockResolvedValue({
        professionId: 1,
        profession: { name: 'Mining', kind: 'gathering', canEnhance: false },
      });

      await expect(
        service.publishOffer({ crafterEmail: CRAFTER, pricePerStamina: 50, crafting: true, enhancing: false }),
      ).rejects.toThrow('Mining cannot be hired out');
      expect(prisma.serviceOffer.upsert).not.toHaveBeenCalled();
    });

    it('refuses an offer from someone without a profession', async () => {
      prisma.userProfession.findFirst = jest.fn().mockResolvedValue(null);

      await expect(
        service.publishOffer({ crafterEmail: CRAFTER, pricePerStamina: 50, crafting: true, enhancing: false }),
      ).rejects.toThrow('You have not learned a profession');
    });

    it('refuses an offer that sells nothing, or sells it for nothing', async () => {
      prisma.userProfession.findFirst = jest.fn().mockResolvedValue({
        professionId: 4,
        profession: { name: 'Blacksmithing', kind: 'crafting', canEnhance: true },
      });

      await expect(
        service.publishOffer({ crafterEmail: CRAFTER, pricePerStamina: 0, crafting: true, enhancing: false }),
      ).rejects.toThrow('Price per stamina must be at least 1 silver');
      await expect(
        service.publishOffer({ crafterEmail: CRAFTER, pricePerStamina: 50, crafting: false, enhancing: false }),
      ).rejects.toThrow('Offer at least one service');
    });
  });

  describe('requireOffer', () => {
    it('refuses a service the crafter did not put up for sale', async () => {
      prisma.serviceOffer.findUnique = jest.fn().mockResolvedValue({
        id: 1,
        crafting: true,
        enhancing: false,
        crafter: { name: 'Cookie' },
      });

      await expect(service.requireOffer({ offerId: 1, service: 'enhancing' })).rejects.toThrow(
        'Cookie does not offer that service',
      );
    });

    it('refuses a crafter who is not on the board at all', async () => {
      prisma.serviceOffer.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.requireOffer({ offerId: 99, service: 'crafting' })).rejects.toThrow(
        'This crafter is not offering their services',
      );
    });
  });
});
