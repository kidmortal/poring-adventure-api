import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { NotificationService } from 'src/integrations/notification/notification.service';
import { UsersService } from 'src/feature/users/users.service';
import { GuildRepository } from './guild.repository';

/**
 * Guild membership and lookups. Tasks, blessings and applications each have
 * their own service — see guildTask/guildBlessing/guildApplication.
 */
@Injectable()
export class GuildService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: GuildRepository,
    private readonly websocket: WebsocketService,
    private readonly notificationService: NotificationService,
    private readonly userService: UsersService,
  ) {}

  findAll() {
    return this.repository.findRanking();
  }

  getGuildFromUser(args: { userEmail: string }) {
    return this.repository.notifyUserWithGuild(args);
  }

  async quitFromGuild(args: { userEmail: string }) {
    const member = await this.repository.getUserGuildMember(args);
    if (!member) {
      this.websocket.sendErrorNotification({ email: args.userEmail, text: 'You have no guild' });
      return false;
    }
    if ((member.role as GuildRole) === 'owner') {
      this.websocket.sendErrorNotification({
        email: args.userEmail,
        text: 'You cant leave the guild while you are the owner',
      });
      return false;
    }

    await this._removeUserFromGuild({ userEmail: args.userEmail });
    return true;
  }

  async kickFromGuild(args: { userEmail: string; kickEmail: string }) {
    const member = await this.repository.getUserGuildMember(args);
    if (!member) {
      this.websocket.sendErrorNotification({ email: args.userEmail, text: 'You have no guild' });
      return false;
    }

    const kickMember = await this.repository.getUserGuildMember({ userEmail: args.kickEmail });
    if (!kickMember) {
      this.websocket.sendErrorNotification({
        email: args.userEmail,
        text: 'Wrong user information to kick',
      });
      return false;
    }
    if (member.permissionLevel <= kickMember.permissionLevel) {
      this.websocket.sendErrorNotification({
        email: args.userEmail,
        text: `You can't kick an user with higher role`,
      });
      return false;
    }

    await this._removeUserFromGuild({ userEmail: args.kickEmail });
    return true;
  }

  private async _removeUserFromGuild(args: { userEmail: string }) {
    const data = await this.prisma.guildMember.delete({
      where: { userEmail: args.userEmail },
      include: { guild: true },
    });

    await this.userService.notifyUserUpdateWithProfile({ email: args.userEmail });
    await this.repository.clearGuildCache({ guildId: data.guildId });
    await this.repository.notifyGuildWithUpdate({ guildId: data.guildId });
    await this.repository.notifyUserWithGuild(args);

    await this.notificationService.sendPushNotificationToUser({
      userEmail: args.userEmail,
      title: 'Guild',
      message: `You have left from ${data.guild.name}`,
    });
    await this.notificationService.removeTagFromSubscription({
      userEmail: args.userEmail,
      key: 'guild',
    });
  }
}
