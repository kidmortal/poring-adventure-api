import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { prisma } from 'src/prisma/prisma';

@Injectable()
export class ItemsService {
  create(createItemDto: CreateItemDto) {
    return prisma.item.create({ data: createItemDto });
  }

  async equipItem(args: { itemId: number; userEmail: string }) {
    const item = await prisma.item.findUnique({
      where: { id: args.itemId },
      include: { equipped: true },
    });
    if (!item) {
      throw new BadRequestException(`No item with id ${args.itemId}`);
    }
    if (item.userEmail !== args.userEmail) {
      throw new BadRequestException(`This item isn't yours`);
    }
    if (item.equipped) {
      throw new BadRequestException(`This item is already equipped`);
    }
    const result = await prisma.equippedItem.create({
      data: {
        type: 'weapon',
        item: {
          connect: {
            id: item.id,
          },
        },
        user: {
          connect: {
            email: args.userEmail,
          },
        },
      },
    });
    return result;
  }

  findAll() {
    return `This action returns all items`;
  }

  findOne(id: number) {
    return `This action returns a #${id} item`;
  }

  update(id: number, updateItemDto: UpdateItemDto) {
    return `This action updates a #${id} item`;
  }

  remove(id: number) {
    return `This action removes a #${id} item`;
  }
}
