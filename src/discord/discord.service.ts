import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DiscordService {
  constructor(private readonly prisma: PrismaService) {}
  findOne(args: { discordId: string }) {
    return this.prisma.user.findUnique({
      where: { discordId: args.discordId },
    });
  }
}
