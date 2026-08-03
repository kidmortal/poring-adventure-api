import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { InventoryService } from 'src/feature/items/inventory.service';
import { UserStaminaService } from 'src/feature/users/userStamina.service';
import { UsersService } from 'src/feature/users/users.service';
import { ProfessionService } from './profession.service';
import { rollNodeDrops } from './profession.rules';
import { ITEM_WITH_BUFF } from 'src/feature/items/entities/itemInclude';

/**
 * Gathering: pay the node's stamina, roll its drop table, keep whatever came
 * out. Stamina is the only limit, so a node can be worked until the daily
 * budget runs out.
 */
@Injectable()
export class GatheringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly professions: ProfessionService,
    private readonly stamina: UserStaminaService,
    private readonly inventory: InventoryService,
    private readonly userService: UsersService,
  ) {}
  private readonly logger = new Logger('Gathering');

  getAllNodes() {
    return this.prisma.gatheringNode.findMany({
      include: { profession: true, drops: { include: { item: ITEM_WITH_BUFF } } },
      orderBy: [{ professionId: 'asc' }, { requiredLevel: 'asc' }],
    });
  }

  async gather(args: { userEmail: string; nodeId: number }) {
    const node = await this.prisma.gatheringNode.findUnique({
      where: { id: args.nodeId },
      include: { drops: true },
    });
    if (!node) {
      throw new BadRequestException('Gathering node does not exist');
    }

    await this.professions.requireLearnedProfession({
      userEmail: args.userEmail,
      professionId: node.professionId,
      requiredLevel: node.requiredLevel,
    });

    // Rolled outside the transaction so the result is decided once, whatever
    // the transaction ends up doing.
    const drops = rollNodeDrops(node.drops);

    await this.prisma.$transaction(async (tx) => {
      await this.stamina.consumeStamina({ userEmail: args.userEmail, amount: node.staminaCost, tx });
      for (const drop of drops) {
        await this.inventory.addItemToInventory({
          userEmail: args.userEmail,
          itemId: drop.itemId,
          stack: drop.amount,
          tx,
        });
      }
      await this.professions.addExperience({
        userEmail: args.userEmail,
        professionId: node.professionId,
        amount: node.experience,
        tx,
      });
    });

    this.logger.debug(`${args.userEmail} gathered ${drops.length} drops from ${node.name}`);
    await this.userService.notifyUserUpdateWithProfile({ email: args.userEmail });
    return { node: node.name, experience: node.experience, staminaCost: node.staminaCost, drops };
  }
}
