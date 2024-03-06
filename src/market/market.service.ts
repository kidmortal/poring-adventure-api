import { Injectable } from '@nestjs/common';
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

  findAll() {
    return `This action returns all market`;
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
