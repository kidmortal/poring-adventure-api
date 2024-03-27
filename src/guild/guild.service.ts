import { Inject, Injectable } from '@nestjs/common';
import { CreateGuildDto } from './dto/create-guild.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class GuildService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}
  create(createGuildDto: CreateGuildDto) {
    return 'This action adds a new guild';
  }

  async findAll() {
    const cacheKey = `guild_ranking`;
    const cachedRanking = await this.cache.get(cacheKey);
    if (cachedRanking) return cachedRanking as any;
    const guildRanking = await this.prisma.guild.findMany({
      take: 10,
      orderBy: { experience: 'desc' },
      include: { members: { include: { user: { include: { stats: true } } } } },
    });
    await this.cache.set(cacheKey, guildRanking);
    return guildRanking;
  }

  findOne(id: number) {
    return `This action returns a #${id} guild`;
  }

  remove(id: number) {
    return `This action removes a #${id} guild`;
  }
}
