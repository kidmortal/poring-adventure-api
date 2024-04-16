import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';

@Injectable()
export class DiscordService {
  constructor(private readonly prisma: PrismaService) {}
  findOne(args: { discordId: string }) {
    return this.prisma.user.findUnique({
      where: { discordId: args.discordId },
    });
  }

  inventory(args: { discordId: string }) {
    return this.prisma.inventoryItem.findMany({
      where: { user: { discordId: args.discordId } },
      include: { item: true },
    });
  }
}
