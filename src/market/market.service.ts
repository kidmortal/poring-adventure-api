import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateMarketDto } from './dto/create-market.dto';
// import { UpdateMarketDto } from './dto/update-market.dto';
import { prisma } from 'src/prisma/prisma';

@Injectable()
export class MarketService {
  async create(createMarketDto: CreateMarketDto, sellerEmail: string) {
    const inventoryItem = await prisma.inventoryItem.findUnique({
      where: { itemId: createMarketDto.itemId, userEmail: sellerEmail },
    });

    if (!inventoryItem) {
      throw new BadRequestException(
        `No item found with id ${createMarketDto.itemId} on ${sellerEmail} inventory`,
      );
    }

    if (inventoryItem.stack < createMarketDto.stack) {
      throw new BadRequestException(
        `You only have ${inventoryItem.stack}, but trying to sell ${createMarketDto.stack}`,
      );
    }

    const listed = await prisma.marketListing.findUnique({
      where: {
        sellerEmail,
        inventoryId: inventoryItem.id,
      },
    });

    if (listed) {
      throw new BadRequestException(`There is already a listing of this item`);
    }

    return prisma.marketListing.create({
      data: {
        price: createMarketDto.price,
        stack: createMarketDto.stack,
        seller: {
          connect: {
            email: sellerEmail,
          },
        },
        item: {
          connect: {
            itemId: createMarketDto.itemId,
            userEmail: sellerEmail,
          },
        },
      },
    });
  }

  async purchase(args: { marketListingId: number; buyerEmail: string }) {
    console.log(args);
    // const purchasingUser = await prisma.user.findUnique({
    //   where: { email: args.buyerEmail },
    // });
    // if (!purchasingUser) {
    //   throw new BadRequestException('User not registered');
    // }
    // const marketListing = await prisma.marketListing.findUnique({
    //   where: { id: args.marketListingId },
    // });
    // if (!marketListing) {
    //   throw new BadRequestException('Listing not found');
    // }
    // const purchaseTotalPrice = marketListing.price * marketListing.stack;
    // if (purchasingUser.silver < purchaseTotalPrice) {
    //   throw new BadRequestException('You are too poor for that');
    // }
    // await prisma.user.update({
    //   where: {
    //     email: purchasingUser.email,
    //   },
    //   data: {
    //     silver: {
    //       decrement: purchaseTotalPrice,
    //     },
    //   },
    // });

    // await prisma.user.update({
    //   where: {
    //     email: marketListing.sellerEmail,
    //   },
    //   data: {
    //     silver: {
    //       increment: purchaseTotalPrice,
    //     },
    //   },
    // });

    // await prisma.item.update({
    //   where: {
    //     id: marketListing.itemId,
    //   },
    //   data: {
    //     userEmail: purchasingUser.email,
    //   },
    // });

    // await prisma.marketListing.delete({
    //   where: {
    //     id: marketListing.id,
    //   },
    // });
    return true;
  }

  findAll() {
    return prisma.marketListing.findMany({
      take: 10,
      include: {
        item: {
          include: {
            item: true,
          },
        },
        seller: true,
      },
    });
  }

  findOne(id: number) {
    return `This action returns a #${id} market`;
  }

  // update(id: number, updateMarketDto: UpdateMarketDto) {
  //   return `This action updates a #${id} market`;
  // }

  async remove(id: number, authEmail: string) {
    const marketListing = await prisma.marketListing.findUnique({
      where: { id },
    });

    if (!marketListing) {
      throw new BadRequestException('Listing not found');
    }

    if (marketListing?.sellerEmail !== authEmail) {
      throw new UnauthorizedException(
        `You are signed as ${authEmail}, but the listing number ${id} was made by ${marketListing.sellerEmail}`,
      );
    }

    return prisma.marketListing.delete({ where: { id } });
  }
}
