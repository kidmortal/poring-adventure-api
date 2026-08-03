import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { TRANSACTION_OPTIONS } from 'src/core/prisma/types/prisma';
import { InventoryService } from 'src/feature/items/inventory.service';
import { UserWalletService } from 'src/feature/users/userWallet.service';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { ItemCategory } from 'src/feature/items/constants';
import { MarketRepository } from './market.repository';
import { listingFee, settleSale } from './market.rules';

@Injectable()
export class MarketService {
  constructor(
    private readonly inventory: InventoryService,
    private readonly userWallet: UserWalletService,
    private readonly websocket: WebsocketService,
    private readonly prisma: PrismaService,
    private readonly repository: MarketRepository,
  ) {}

  async findAll(args: { page: number; category: ItemCategory }) {
    const [listings, count] = await Promise.all([this.repository.getListings(args), this.repository.countListings()]);
    return { listings, count };
  }

  /** Lists stacks for sale. Re-listing the same item must keep the same price. */
  async addItemToMarket(args: { price: number; stack: number; inventoryId: number; sellerEmail: string }) {
    const inventoryItem = await this.inventory.getOneInventoryItem({
      userEmail: args.sellerEmail,
      inventoryId: args.inventoryId,
    });

    if (!inventoryItem) {
      throw new BadRequestException(
        `No inventory item found with id ${args.inventoryId} on ${args.sellerEmail} inventory`,
      );
    }
    if (inventoryItem.stack < args.stack) {
      throw new BadRequestException(`You only have ${inventoryItem.stack}, but trying to sell ${args.stack}`);
    }
    if (inventoryItem.locked) {
      return this._deny(args.sellerEmail, 'Item is locked, you cant list it on market');
    }

    const listing = inventoryItem.marketListing;
    if (listing) {
      const remainingStock = inventoryItem.stack - listing.stack;
      if (args.stack > remainingStock) {
        return this._deny(args.sellerEmail, `You only have ${remainingStock}, but trying to post ${args.stack} stacks`);
      }
      if (args.price !== listing.price) {
        return this._deny(
          args.sellerEmail,
          `Item already listed for ${listing.price} silver, you cant post again with different price`,
        );
      }
    }

    // Charged before anything is posted, and never given back: a listing that
    // costs nothing is a listing worth posting at any price, which is how the
    // board fills with speculation nobody intends to sell at.
    const fee = listingFee({ price: args.price, stacks: args.stack });
    const seller = await this.prisma.user.findUnique({
      where: { email: args.sellerEmail },
      select: { silver: true },
    });
    if (!seller) {
      throw new BadRequestException('User not registered');
    }
    if (seller.silver < fee) {
      return this._deny(args.sellerEmail, `Listing costs ${fee} silver in fees, and you do not have it`);
    }

    await this.prisma.$transaction(async (tx) => {
      if (fee > 0) {
        await this.userWallet.removeSilverFromUser({ userEmail: args.sellerEmail, amount: fee, tx });
      }
      await this.repository.createOrIncrementListing({
        price: args.price,
        stack: args.stack,
        inventoryId: inventoryItem.id,
        sellerEmail: args.sellerEmail,
        tx,
      });
    }, TRANSACTION_OPTIONS);

    this.websocket.sendTextNotification({
      email: args.sellerEmail,
      text: `Listed ${args.stack}x ${inventoryItem.item.name} on Market${fee > 0 ? ` for ${fee} silver in fees` : ''}!`,
    });
    await this._invalidate(inventoryItem.item.category as ItemCategory);
    return true;
  }

  /** Moves silver one way and the item the other, atomically. */
  async purchase(args: { marketListingId: number; stacks: number; buyerEmail: string }) {
    const category = await this.prisma.$transaction(async (tx) => {
      const buyer = await tx.user.findUnique({ where: { email: args.buyerEmail } });
      if (!buyer) {
        throw new BadRequestException('User not registered');
      }

      const listing = await this.repository.getListing({ marketListingId: args.marketListingId, tx });
      if (!listing) {
        throw new BadRequestException('Listing not found');
      }

      // The buyer pays what the board says; the tax comes out of the seller's
      // half and simply stops existing, which is the point — it is the only
      // sink in the game that scales with how much trading is going on.
      const { total, tax, payout } = settleSale({ price: listing.price, stacks: args.stacks });
      if (buyer.silver < total) {
        throw new BadRequestException('You are too poor for that');
      }

      await this.repository.decrementOrRemoveListing({
        marketListingId: listing.id,
        currentStacks: listing.stack,
        decrementStacks: args.stacks,
        tx,
      });
      await this.userWallet.removeSilverFromUser({ userEmail: buyer.email, amount: total, tx });
      await this.userWallet.addSilverToUser({ userEmail: listing.sellerEmail, amount: payout, tx });
      if (tax > 0) {
        this.websocket.sendTextNotification({
          email: listing.sellerEmail,
          text: `Sold ${args.stacks}x for ${payout} silver, after ${tax} in market tax`,
        });
      }
      await this.inventory.transferItemFromUserToUser({
        senderEmail: listing.sellerEmail,
        receiverEmail: buyer.email,
        inventoryId: listing.inventoryId,
        stack: args.stacks,
        tx,
      });
      return listing.inventory?.item?.category as ItemCategory;
    }, TRANSACTION_OPTIONS);

    await this._invalidate(category);
    return true;
  }

  async remove(args: { marketListingId: number; userEmail: string }) {
    const listing = await this.repository.getListing(args);
    if (!listing) {
      throw new BadRequestException('Listing not found');
    }
    if (listing.sellerEmail !== args.userEmail) {
      throw new UnauthorizedException(
        `You are signed as ${args.userEmail}, but the listing number ${args.marketListingId} was made by ${listing.sellerEmail}`,
      );
    }

    const deletedItem = await this.repository.deleteListing(args);
    this.websocket.sendTextNotification({
      email: args.userEmail,
      text: `Removed ${deletedItem.stack}x ${deletedItem.inventory.item.name} from Market!`,
    });
    await this._invalidate(deletedItem.inventory?.item?.category as ItemCategory);
    return deletedItem;
  }

  private _invalidate(category: ItemCategory) {
    return this.repository.clearCache({ categories: ['all', category] });
  }

  private _deny(email: string, text: string) {
    this.websocket.sendErrorNotification({ email, text });
    return false;
  }
}
