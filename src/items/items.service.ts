import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateItemDto } from './dto/create-item.dto';
// import { UpdateItemDto } from './dto/update-item.dto';
import { prisma } from 'src/prisma/prisma';
import { UsersService } from 'src/users/users.service';
import { EQUIPABLE_CATEGORIES } from './entities/categories';
import { Item } from '@prisma/client';

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
    const inventoryItem = await this.getInventoryItem(args);
    if (inventoryItem) {
      if (!EQUIPABLE_CATEGORIES.includes(inventoryItem.item.category)) {
        throw new BadRequestException('This item is not equipable');
      }

      const equippedItems = await prisma.equippedItem.findMany({
        where: {
          userEmail: args.userEmail,
        },
        include: {
          item: true,
        },
      });

      equippedItems.forEach((equip) => {
        if (equip.item.category === inventoryItem.item.category) {
          throw new BadRequestException(
            'You cannot equip two of the same kind of equipment',
          );
        }
      });

      await this.removeItemFromUser({ ...args, stack: 1 });
      await this.addEquipmentToUser({ ...args, itemInfo: inventoryItem.item });
    }
    return false;
  }

  async unequipItem(args: { itemId: number; userEmail: string }) {
    const equippedItem = await this.getEquippedItem(args);
    if (equippedItem) {
      await this.addItemToUser({ ...args, stack: 1 });

      await this.removeEquipmentFromUser({
        ...args,
        itemInfo: equippedItem.item,
      });
    }
    return false;
  }

  async addEquipmentToUser(args: {
    itemId: number;
    userEmail: string;
    itemInfo: Item;
  }) {
    await this.userService.increaseUserStats({
      userEmail: args.userEmail,
      health: args.itemInfo.health,
      attack: args.itemInfo.attack,
    });

    return prisma.equippedItem.create({
      data: {
        userEmail: args.userEmail,
        itemId: args.itemId,
      },
    });
  }
  async removeEquipmentFromUser(args: {
    itemId: number;
    userEmail: string;
    itemInfo: Item;
  }) {
    await this.userService.decreaseUserStats({
      userEmail: args.userEmail,
      health: args.itemInfo.health,
      attack: args.itemInfo.attack,
    });

    return prisma.equippedItem.delete({
      where: {
        userEmail_itemId: {
          userEmail: args.userEmail,
          itemId: args.itemId,
        },
      },
    });
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
      false;
    }
    return userHasItem;
  }

  async getInventoryItem(args: { userEmail: string; itemId: number }) {
    const inventoryItem = await prisma.inventoryItem.findUnique({
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

    if (!inventoryItem) {
      false;
    }
    return inventoryItem;
  }

  async getEquippedItem(args: { userEmail: string; itemId: number }) {
    return prisma.equippedItem.findUnique({
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
  }

  // update(id: number, updateItemDto: UpdateItemDto) {
  //   return `This action updates a #${id} item`;
  // }

  remove(id: number) {
    return `This action removes a #${id} item`;
  }
}
