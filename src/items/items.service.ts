import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateItemDto } from './dto/create-item.dto';
// import { UpdateItemDto } from './dto/update-item.dto';
import { prisma } from 'src/prisma/prisma';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class ItemsService {
  constructor(private readonly userService: UsersService) {}
  create(createItemDto: CreateItemDto) {
    return prisma.item.create({ data: createItemDto });
  }

  async removeItemFromUser(args: {
    userEmail: string;
    itemId: number;
    stack: number;
  }) {
    const userHasItem = await this.userHasItem(args);

    if (userHasItem && userHasItem.stack < args.stack) {
      throw new BadRequestException(
        `User only have ${userHasItem.stack} stacks, but you trying to remove ${args.stack}`,
      );
    }

    if (userHasItem.stack === args.stack) {
      const updateAmount = await prisma.inventoryItem.delete({
        where: {
          userEmail_itemId: {
            userEmail: args.userEmail,
            itemId: args.itemId,
          },
        },
      });
      return updateAmount;
    }

    if (userHasItem.stack > args.stack) {
      const updateAmount = await prisma.inventoryItem.update({
        where: {
          userEmail_itemId: {
            userEmail: args.userEmail,
            itemId: args.itemId,
          },
        },
        data: {
          stack: {
            decrement: args.stack,
          },
        },
      });
      return updateAmount;
    }

    throw new BadRequestException(
      `There was an error processing this`,
      `args: ${JSON.stringify(args)}`,
    );
  }

  async consumeItem(args: {
    userEmail: string;
    itemId: number;
    stack: number;
  }) {
    const inventoryItem = await this.getInventoryItem(args);
    if (inventoryItem) {
      const item = inventoryItem.item;
      if (item.category === 'consumable') {
        if (item.health) {
          await this.userService.incrementUserHealth({
            userEmail: args.userEmail,
            amount: item.health,
          });
        }
        await this.removeItemFromUser(args);
        return true;
      }
    }
  }

  async addItemToUser(args: {
    userEmail: string;
    itemId: number;
    stack: number;
  }) {
    const userHasItem = await this.userHasItem(args);

    if (userHasItem) {
      const updateAmount = await prisma.inventoryItem.update({
        where: {
          userEmail_itemId: {
            userEmail: args.userEmail,
            itemId: args.itemId,
          },
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

  async transferItemFromUserToUser(args: {
    senderEmail: string;
    receiverEmail: string;
    itemId: number;
    stack: number;
  }) {
    await this.removeItemFromUser({
      itemId: args.itemId,
      stack: args.stack,
      userEmail: args.senderEmail,
    });

    return this.addItemToUser({
      itemId: args.itemId,
      stack: args.stack,
      userEmail: args.receiverEmail,
    });
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

  async userHasItem(args: { userEmail: string; itemId: number }) {
    const userHasItem = await prisma.inventoryItem.findUnique({
      where: {
        userEmail_itemId: {
          userEmail: args.userEmail,
          itemId: args.itemId,
        },
      },
    });

    if (!userHasItem) {
      throw new BadRequestException('User doesnt have this item');
    }
    return userHasItem;
  }

  async getInventoryItem(args: { userEmail: string; itemId: number }) {
    const userHasItem = await prisma.inventoryItem.findUnique({
      where: {
        userEmail_itemId: {
          userEmail: args.userEmail,
          itemId: args.itemId,
        },
      },
      include: {
        item: true,
      },
    });

    if (!userHasItem) {
      throw new BadRequestException('User doesnt have this item');
    }
    return userHasItem;
  }

  // update(id: number, updateItemDto: UpdateItemDto) {
  //   return `This action updates a #${id} item`;
  // }

  remove(id: number) {
    return `This action removes a #${id} item`;
  }
}
