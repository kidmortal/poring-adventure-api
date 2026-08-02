import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

import { PrismaService } from 'src/core/prisma/prisma.service';
import { TRANSACTION_OPTIONS } from 'src/core/prisma/types/prisma';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { InventoryService } from 'src/feature/items/inventory.service';
import { UsersService } from 'src/feature/users/users.service';
import { GuildRepository } from './guild.repository';

/**
 * The guild store. It is paid for in guild tokens, which are earned by
 * contributing to guild tasks and by fighting the guild boss — so the shelf is
 * stocked by the guild's own work rather than by silver.
 */
@Injectable()
export class GuildStoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: GuildRepository,
    private readonly inventory: InventoryService,
    private readonly userService: UsersService,
    private readonly websocket: WebsocketService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}
  private readonly logger = new Logger('Guild store');

  async findAllProducts() {
    const cacheKey = 'guild_store_products';
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const products = await this.prisma.guildStoreProduct.findMany({
      where: { enabled: true },
      include: { item: true },
      orderBy: { price: 'asc' },
    });
    await this.cache.set(cacheKey, products);
    return products;
  }

  async buy(args: { userEmail: string; productId: number; amount: number }) {
    const amount = Math.floor(args.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return this._deny(args.userEmail, 'Buy at least one');
    }

    const member = await this.repository.getUserGuildMember({ userEmail: args.userEmail });
    if (!member) return this._deny(args.userEmail, 'You have no guild');

    const product = await this.prisma.guildStoreProduct.findUnique({
      where: { id: args.productId },
      include: { item: true },
    });
    if (!product || !product.enabled) return this._deny(args.userEmail, 'That is not for sale');

    const cost = product.price * amount;
    if (member.guildTokens < cost) {
      return this._deny(args.userEmail, `Not enough guild tokens (need ${cost}, have ${member.guildTokens})`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.guildMember.update({
        where: { userEmail: args.userEmail },
        data: { guildTokens: { decrement: cost } },
      });
      await this.inventory.addItemToInventory({
        userEmail: args.userEmail,
        itemId: product.itemId,
        stack: product.stack * amount,
        quality: 1,
        enhancement: 0,
        tx,
      });
    }, TRANSACTION_OPTIONS);

    this.logger.debug(`${args.userEmail} bought ${amount}x ${product.item.name} for ${cost} tokens`);

    // The member's token balance rides on the guild payload, so both go stale.
    await this.repository.clearGuildCache({ guildId: member.guildId });
    await this.repository.notifyGuildWithUpdate({ guildId: member.guildId });
    await this.userService.notifyUserUpdateWithProfile({ email: args.userEmail });
    this.websocket.sendTextNotification({
      email: args.userEmail,
      text: `Bought ${product.stack * amount}x ${product.item.name}`,
    });
    return true;
  }

  private _deny(email: string, text: string) {
    this.websocket.sendErrorNotification({ email, text });
    return false;
  }
}
