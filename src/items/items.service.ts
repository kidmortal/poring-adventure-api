import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateItemDto } from './dto/create-item.dto';
// import { UpdateItemDto } from './dto/update-item.dto';
import { prisma } from 'src/prisma/prisma';

@Injectable()
export class ItemsService {
  create(createItemDto: CreateItemDto) {
    return prisma.item.create({ data: createItemDto });
  }

  async addItemToUser(args: {
    userEmail: string;
    itemId: number;
    stack: number;
  }) {
    const userHasItem = await prisma.inventoryItem.findUnique({
      where: {
        userEmail: args.userEmail,
        itemId: args.itemId,
      },
    });
    if (userHasItem) {
      const updateAmount = await prisma.inventoryItem.update({
        where: {
          userEmail: args.userEmail,
          itemId: args.itemId,
        },
        data: {
          stack: {
            increment: args.stack,
          },
        },
      });
      return updateAmount;
    }
    try {
      const createNewItem = await prisma.inventoryItem.create({
        data: {
          userEmail: args.userEmail,
          itemId: args.itemId,
          stack: args.stack,
        },
      });
      return createNewItem;
    } catch (error) {
      throw new BadRequestException(
        'Either the user or the item does not exist',
      );
    }
  }

  async equipItem(args: { itemId: number; userEmail: string }) {
    console.log(args);
    // const item = await prisma.item.findUnique({
    //   where: { id: args.itemId },
    //   include: { equipped: true },
    // });
    // if (!item) {
    //   throw new BadRequestException(`No item with id ${args.itemId}`);
    // }
    // if (item.userEmail !== args.userEmail) {
    //   throw new BadRequestException(`This item isn't yours`);
    // }
    // if (item.equipped) {
    //   throw new BadRequestException(`This item is already equipped`);
    // }
    // const result = await prisma.equippedItem.create({
    //   data: {
    //     type: 'weapon',
    //     item: {
    //       connect: {
    //         id: item.id,
    //       },
    //     },
    //     user: {
    //       connect: {
    //         email: args.userEmail,
    //       },
    //     },
    //   },
    // });
    // return result;
    return true;
  }

  findAll() {
    return `This action returns all items`;
  }

  findOne(id: number) {
    return `This action returns a #${id} item`;
  }

  // update(id: number, updateItemDto: UpdateItemDto) {
  //   return `This action updates a #${id} item`;
  // }

  remove(id: number) {
    return `This action removes a #${id} item`;
  }
}
