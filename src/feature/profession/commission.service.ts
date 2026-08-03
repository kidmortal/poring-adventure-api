import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { TRANSACTION_OPTIONS } from 'src/core/prisma/types/prisma';
import { InventoryService } from 'src/feature/items/inventory.service';
import { UserWalletService } from 'src/feature/users/userWallet.service';
import { UsersService } from 'src/feature/users/users.service';
import { planIngredientConsumption } from './profession.rules';
import { ProfessionService } from './profession.service';
import { pickDailyCommissions, utcDayKey } from './commission.rules';
import { ITEM_WITH_BUFF } from 'src/feature/items/entities/itemInclude';

/**
 * The commission board: standing NPC contracts a crafter can fill for silver.
 *
 * This is the demand engine the economy was missing. Player demand for crafted
 * goods is one-shot — once a cook has made two hundred cakes that need is met
 * for the whole server, permanently — while the cook's stamina refills every
 * morning. Any market shaped like that collapses to zero price. A board that
 * re-draws daily puts a floor under every crafted item and, by extension, under
 * the materials that go into it, which is what finally pays the gatherers.
 *
 * It is also the non-combat player's income. Battle costs no stamina and pays
 * without limit; crafting is capped at fifty stamina a day and can never catch
 * up on price alone. The payouts here are deliberately a supplement rather than
 * a match: a full board is worth roughly half of what a grinder makes.
 */
@Injectable()
export class CommissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly professions: ProfessionService,
    private readonly inventory: InventoryService,
    private readonly wallet: UserWalletService,
    private readonly userService: UsersService,
  ) {}
  private readonly logger = new Logger('Commissions');

  /**
   * Today's board, with each contract marked according to whether the player
   * can fill it right now and whether they already have.
   */
  async getBoard(args: { userEmail: string }) {
    const learned = await this.professions.getUserProfession({ userEmail: args.userEmail });
    if (!learned) return { profession: null, day: utcDayKey(new Date()), commissions: [] };

    const day = utcDayKey(new Date());
    const available = await this.prisma.commission.findMany({
      where: { professionId: learned.professionId },
      include: { item: ITEM_WITH_BUFF },
    });

    const offered = pickDailyCommissions({
      available,
      userEmail: args.userEmail,
      professionId: learned.professionId,
      level: learned.level,
      day,
    });

    const delivered = await this.prisma.userCommission.findMany({
      where: { userEmail: args.userEmail, offeredOn: day },
      select: { commissionId: true },
    });
    const filled = new Set(delivered.map((entry) => entry.commissionId));

    // One read of the inventory answers "can I fill this?" for every contract on
    // the board, rather than one round trip each.
    const owned = await this._deliverableStacks({ userEmail: args.userEmail });

    return {
      profession: learned.profession.name,
      day,
      commissions: offered.map((option) => {
        const commission = available.find((entry) => entry.id === option.id);
        return {
          id: commission.id,
          item: commission.item,
          amount: commission.amount,
          silver: commission.silver,
          experience: commission.experience,
          requiredLevel: commission.requiredLevel,
          delivered: filled.has(commission.id),
          owned: owned
            .filter((stack) => stack.itemId === commission.itemId)
            .reduce((total, stack) => total + stack.stack, 0),
        };
      }),
    };
  }

  /**
   * Hands the goods over and takes the payment.
   *
   * Quality is not checked: the contract asks for ten potions, not ten good
   * ones, and a crafter who wants to keep their legendary stock and turn in the
   * commons is making exactly the trade the board is meant to allow.
   */
  async deliver(args: { userEmail: string; commissionId: number }) {
    const day = utcDayKey(new Date());
    const commission = await this.prisma.commission.findUnique({
      where: { id: args.commissionId },
      include: { item: ITEM_WITH_BUFF },
    });
    if (!commission) {
      throw new BadRequestException('That commission does not exist');
    }

    const learned = await this.professions.requireLearnedProfession({
      userEmail: args.userEmail,
      professionId: commission.professionId,
      requiredLevel: commission.requiredLevel,
    });

    // Checked against the same draw the board renders from, so a contract that
    // was never offered cannot be filled by guessing its id.
    const available = await this.prisma.commission.findMany({
      where: { professionId: commission.professionId },
      select: { id: true, requiredLevel: true, professionId: true },
    });
    const offered = pickDailyCommissions({
      available,
      userEmail: args.userEmail,
      professionId: commission.professionId,
      level: learned.level,
      day,
    });
    if (!offered.some((option) => option.id === commission.id)) {
      throw new BadRequestException('That commission is not on your board today');
    }

    const alreadyFilled = await this.prisma.userCommission.findUnique({
      where: {
        userEmail_commissionId_offeredOn: { userEmail: args.userEmail, commissionId: commission.id, offeredOn: day },
      },
    });
    if (alreadyFilled) {
      throw new BadRequestException('You already filled that commission today');
    }

    const owned = await this._deliverableStacks({ userEmail: args.userEmail });
    const consumption = planIngredientConsumption({
      required: [{ itemId: commission.itemId, amount: commission.amount }],
      owned,
    });
    if (!consumption) {
      throw new BadRequestException(`You need ${commission.amount}x ${commission.item.name}`);
    }

    await this.prisma.$transaction(async (tx) => {
      for (const taken of consumption) {
        await this.inventory.removeItemFromInventory({
          userEmail: args.userEmail,
          inventoryId: taken.inventoryId,
          stack: taken.stack,
          tx,
        });
      }
      await this.wallet.addSilverToUser({ userEmail: args.userEmail, amount: commission.silver, tx });
      await this.professions.addExperience({
        userEmail: args.userEmail,
        professionId: commission.professionId,
        amount: commission.experience,
        tx,
      });
      // Written inside the job, so a rolled back delivery leaves the contract
      // open rather than marking it filled for a payment that never landed.
      await tx.userCommission.create({
        data: { userEmail: args.userEmail, commissionId: commission.id, offeredOn: day },
      });
    }, TRANSACTION_OPTIONS);

    this.logger.debug(
      `${args.userEmail} delivered ${commission.amount}x ${commission.item.name} for ${commission.silver} silver`,
    );
    await this.userService.notifyUserUpdateWithProfile({ email: args.userEmail });

    return {
      item: commission.item.name,
      amount: commission.amount,
      silver: commission.silver,
      experience: commission.experience,
    };
  }

  /** Stacks a delivery may draw on: never what is worn, listed or locked. */
  private _deliverableStacks(args: { userEmail: string }) {
    return this.prisma.inventoryItem.findMany({
      where: { userEmail: args.userEmail, equipped: false, locked: false, marketListing: null },
      orderBy: { stack: 'asc' },
    });
  }
}
