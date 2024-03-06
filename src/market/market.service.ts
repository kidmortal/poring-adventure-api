import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateMarketDto } from './dto/create-market.dto';
import { UpdateMarketDto } from './dto/update-market.dto';
import { prisma } from 'src/prisma/prisma';

@Injectable()
export class MarketService {
  create(createMarketDto: CreateMarketDto) {
    return prisma.marketListing.create({
      data: {
        price: createMarketDto.price,
        stack: createMarketDto.stack,
        seller: {
          connect: {
            email: createMarketDto.sellerEmail,
          },
        },
        item: {
          connect: {
            id: createMarketDto.itemId,
          },
        },
      },
    });
  }

  async purchase(args: { marketListingId: number; buyerEmail: string }) {
    const purchasingUser = await prisma.user.findUnique({
      where: { email: args.buyerEmail },
    });
    if (!purchasingUser) {
      throw new BadRequestException('User not registered');
    }
    const marketListing = await prisma.marketListing.findUnique({
      where: { id: args.marketListingId },
    });
    if (!marketListing) {
      throw new BadRequestException('Listing not found');
    }
    const purchaseTotalPrice = marketListing.price * marketListing.stack;
    if (purchasingUser.silver < purchaseTotalPrice) {
      throw new BadRequestException('You are too poor for that');
    }
    await prisma.user.update({
      where: {
        email: purchasingUser.email,
      },
      data: {
        silver: {
          decrement: purchaseTotalPrice,
        },
      },
    });

    await prisma.user.update({
      where: {
        email: marketListing.sellerEmail,
      },
      data: {
        silver: {
          increment: purchaseTotalPrice,
        },
      },
    });

    await prisma.item.update({
      where: {
        id: marketListing.itemId,
      },
      data: {
        userEmail: purchasingUser.email,
      },
    });

    await prisma.marketListing.delete({
      where: {
        id: marketListing.id,
      },
    });
    return true;
  }

  findAll() {
    return prisma.marketListing.findMany({
      take: 10,
      include: {
        item: true,
      },
    });
  }

  findOne(id: number) {
    return `This action returns a #${id} market`;
  }

  update(id: number, updateMarketDto: UpdateMarketDto) {
    return `This action updates a #${id} market`;
  }

  remove(id: number) {
    return `This action removes a #${id} market`;
  }
}
