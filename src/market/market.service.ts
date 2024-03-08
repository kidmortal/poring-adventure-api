import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateMarketDto } from './dto/create-market.dto';
// import { UpdateMarketDto } from './dto/update-market.dto';
import { prisma } from 'src/prisma/prisma';
import { ItemsService } from 'src/items/items.service';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class MarketService {
  constructor(
    private readonly itemService: ItemsService,
    private readonly userService: UsersService,
  ) {}
  async addItemToMarket(createMarketDto: CreateMarketDto, sellerEmail: string) {
    const inventoryItem = await prisma.inventoryItem.findUnique({
      where: {
        userEmail_itemId: {
          itemId: createMarketDto.itemId,
          userEmail: sellerEmail,
        },
      },
      include: {
        marketListing: true,
      },
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

    if (inventoryItem.marketListing) {
      const remainingStock =
        inventoryItem.stack - inventoryItem.marketListing.stack;

      if (createMarketDto.stack > remainingStock) {
        throw new BadRequestException(
          `You only have ${remainingStock}, but trying to post ${createMarketDto.stack} stacks`,
        );
      }
    }

    return this.createOrIncrementMarketListing({
      price: createMarketDto.price,
      stack: createMarketDto.stack,
      currentStacks: inventoryItem.stack,
      inventoryId: inventoryItem.id,
      sellerEmail,
    });
  }

  async purchase(args: {
    marketListingId: number;
    buyerEmail: string;
    stacks: number;
  }) {
    const purchasingUser = await prisma.user.findUnique({
      where: { email: args.buyerEmail },
    });
    if (!purchasingUser) {
      throw new BadRequestException('User not registered');
    }
    const marketListing = await prisma.marketListing.findUnique({
      where: { id: args.marketListingId },
      include: {
        inventory: true,
      },
    });
    if (!marketListing) {
      throw new BadRequestException('Listing not found');
    }
    const purchaseTotalPrice = marketListing.price * args.stacks;
    if (purchasingUser.silver < purchaseTotalPrice) {
      throw new BadRequestException('You are too poor for that');
    }

    await this.decrementOrRemoveMarketListing({
      marketListingId: marketListing.id,
      currentStacks: marketListing.stack,
      decrementStacks: args.stacks,
    });

    await this.userService.transferSilverFromUserToUser({
      senderEmail: purchasingUser.email,
      receiverEmail: marketListing.sellerEmail,
      amount: purchaseTotalPrice,
    });

    await this.itemService.transferItemFromUserToUser({
      senderEmail: marketListing.sellerEmail,
      receiverEmail: purchasingUser.email,
      itemId: marketListing.inventory.itemId,
      stack: args.stacks,
    });
  }

  async createOrIncrementMarketListing(args: {
    price: number;
    stack: number;
    currentStacks: number;
    inventoryId: number;
    sellerEmail: string;
  }) {
    return prisma.marketListing.upsert({
      where: {
        sellerEmail: args.sellerEmail,
        inventoryId: args.inventoryId,
      },
      create: {
        price: args.price,
        stack: args.stack,
        seller: {
          connect: {
            email: args.sellerEmail,
          },
        },
        inventory: {
          connect: {
            id: args.inventoryId,
          },
        },
      },
      update: {
        stack: {
          increment: args.stack,
        },
      },
    });
  }

  async decrementOrRemoveMarketListing(args: {
    marketListingId: number;
    currentStacks: number;
    decrementStacks: number;
  }) {
    if (args.decrementStacks < args.currentStacks) {
      return await prisma.marketListing.update({
        where: {
          id: args.marketListingId,
        },
        data: {
          stack: {
            decrement: args.decrementStacks,
          },
        },
      });
    }
    if (args.decrementStacks === args.currentStacks) {
      return await prisma.marketListing.delete({
        where: {
          id: args.marketListingId,
        },
      });
    }
    throw new BadRequestException(
      `Invalid decrement has been provided, you cant remove ${args.decrementStacks} from ${args.currentStacks}`,
    );
  }

  findAll() {
    return prisma.marketListing.findMany({
      take: 10,
      include: {
        inventory: {
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
