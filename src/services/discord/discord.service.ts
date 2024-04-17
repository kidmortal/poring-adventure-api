import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { RegisterDiscordProfilePayload } from './dto/register';
import { randomUUID } from 'crypto';

@Injectable()
export class DiscordService {
  constructor(private readonly prisma: PrismaService) {}
  private tokens: { [email: string]: string } = {};

  createRegisterToken(args: { userEmail: string }) {
    const registeredToken = this.tokens[args.userEmail];
    if (registeredToken) {
      return registeredToken;
    } else {
      const token = randomUUID();
      this.tokens[args.userEmail] = token;
      return token;
    }
  }

  findOne(args: { discordId: string }) {
    return this.prisma.user.findFirst({
      where: { discord: { discordId: args.discordId } },
      include: { appearance: true },
    });
  }

  async register(args: RegisterDiscordProfilePayload) {
    console.log(args);
    const hasToken = this._findTokenByToken({ token: args.token });
    if (!hasToken) {
      return false;
    }
    const email = hasToken.key;
    const updateProfile = await this.prisma.discord.upsert({
      where: { userEmail: email },
      create: { discordId: args.id, name: args.name, url: args.url, userEmail: email },
      update: { discordId: args.id, name: args.name, url: args.url, userEmail: email },
      include: { user: true },
    });
    return updateProfile.user;
  }

  inventory(args: { discordId: string }) {
    return this.prisma.inventoryItem.findMany({
      where: { user: { discord: { discordId: args.discordId } } },
      include: { item: true },
    });
  }

  discordProfile(args: { userEmail: string }) {
    return this.prisma.discord.findUnique({ where: { userEmail: args.userEmail } });
  }

  private _findTokenByToken(args: { token: string }) {
    for (const entry of Object.entries(this.tokens)) {
      const [key, value] = entry;
      if (value === args.token) {
        return { key, value };
      }
    }
    return false;
  }
}
