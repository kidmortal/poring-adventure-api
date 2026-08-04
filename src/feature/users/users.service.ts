import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { UsersRepository } from './users.repository';
import { UserStaminaService } from './userStamina.service';

/**
 * The user profile itself: account lifecycle, lookups and pushing profile
 * updates to the client. Stats live in UserStatsService, currencies in
 * UserWalletService, cached reads in UsersRepository.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly websocket: WebsocketService,
    private readonly prisma: PrismaService,
    private readonly repository: UsersRepository,
    private readonly stamina: UserStaminaService,
  ) {}

  notifyUserUpdate(args: { email: string; payload: any }) {
    return this.websocket.sendMessageToSocket({
      email: args.email,
      event: 'user_update',
      payload: args.payload,
    });
  }

  /** Re-reads the profile from the database and pushes it to the user's sockets. */
  async notifyUserUpdateWithProfile(args: { email: string }) {
    await this.repository.clearUserCache(args);
    const user = await this.repository.getFullUser({ userEmail: args.email });
    if (!user) return false;

    this.notifyUserUpdate({ email: args.email, payload: user });
    return true;
  }

  /** Reading the profile is the moment a new day's stamina is granted. */
  async findOne(args: { userEmail: string }) {
    await this.stamina.refillIfNewDay({ userEmail: args.userEmail });
    await this.notifyUserUpdateWithProfile({ email: args.userEmail });
    return true;
  }

  create(createUserDto: CreateUserDto) {
    return this.prisma.user.create({
      data: {
        name: createUserDto.name,
        email: createUserDto.email,
        appearance: {
          create: {
            costume: createUserDto.costume,
            gender: createUserDto.gender,
            head: '1',
          },
        },
        stats: { create: { experience: 1 } },
        classId: createUserDto.classId,
      },
    });
  }

  async getUsersPage(args: { page: number }) {
    const [users, count] = await Promise.all([this.repository.getUsersPage(args), this.repository.getUserCount()]);
    return { users, count };
  }

  getAllClasses() {
    return this.prisma.class.findMany({ include: { skills: { include: { buff: true, debuff: true } } } });
  }

  getAllHeads() {
    return this.prisma.head.findMany({});
  }

  async updateUserName(args: { email: string; newName: string }) {
    await this.prisma.user.update({
      where: { email: args.email },
      data: { name: args.newName },
    });
    await this.repository.clearUserCache({ email: args.email });
    return true;
  }

  deleteUser(email: string) {
    return this.prisma.user.delete({ where: { email } });
  }

  isAdmin(args: { adminEmail: string }) {
    return this.repository.isAdmin(args);
  }

  clearUserCache(args: { email: string }) {
    return this.repository.clearUserCache(args);
  }

  /** Backfills the stats row for accounts created before stats were mandatory. */
  async revalidateUsers() {
    const invalidUsers = await this.prisma.user.findMany({ where: { stats: null } });
    for await (const user of invalidUsers) {
      await this.prisma.stats.create({ data: { userEmail: user.email } });
    }
  }
}
