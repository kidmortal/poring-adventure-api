import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { NotificationService } from 'src/integrations/notification/notification.service';
import { UsersService } from 'src/feature/users/users.service';
import { GuildRepository } from './guild.repository';
import { GuildPermission, GuildPermissions } from './guild.permissions';

/** Players asking to join a guild, and officers answering them. */
@Injectable()
export class GuildApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: GuildRepository,
    private readonly permissions: GuildPermissions,
    private readonly websocket: WebsocketService,
    private readonly notificationService: NotificationService,
    private readonly userService: UsersService,
  ) {}

  async applyToGuild(args: { userEmail: string; guildId: number }) {
    const existing = await this.prisma.guildApplication.findFirst({ where: args });
    if (existing) {
      this.websocket.sendErrorNotification({
        email: args.userEmail,
        text: `You've already applied to this guild`,
      });
      return false;
    }

    await this.prisma.guildApplication.create({ data: args });
    await this.repository.clearGuildCache({ guildId: args.guildId });
    this.websocket.sendTextNotification({
      email: args.userEmail,
      text: 'Application sent to the guild',
    });
    return true;
  }

  async acceptGuildApplication(args: { userEmail: string; applicationId: number }) {
    const member = await this.permissions.requireMember({
      userEmail: args.userEmail,
      level: GuildPermission.MANAGE_APPLICATIONS,
    });
    if (!member) return false;

    await this.prisma.$transaction(async (tx) => {
      const application = await tx.guildApplication.findUnique({
        where: { id: args.applicationId },
        include: { guild: true },
      });
      if (!application) return;

      const { userEmail: applicantEmail, guildId } = application;
      // Joining one guild withdraws every other application the player has open.
      await tx.guildApplication.deleteMany({ where: { userEmail: applicantEmail } });
      await tx.guildMember.create({ data: { guildId, userEmail: applicantEmail } });

      await this.notificationService.sendPushNotificationToUser({
        userEmail: applicantEmail,
        title: 'Guild application',
        message: `You have joined ${application.guild.name}`,
      });
      await this.notificationService.addTagToSubscription({
        key: 'guild',
        value: String(guildId),
        userEmail: applicantEmail,
      });
      await this.userService.notifyUserUpdateWithProfile({ email: applicantEmail });
    });

    this.websocket.sendTextNotification({ email: args.userEmail, text: 'Application accepted' });
    await this._refresh(member.guildId);
    return true;
  }

  async refuseGuildApplication(args: { userEmail: string; applicationId: number }) {
    const member = await this.permissions.requireMember({
      userEmail: args.userEmail,
      level: GuildPermission.MANAGE_APPLICATIONS,
    });
    if (!member) return false;

    await this.prisma.guildApplication.delete({
      where: { id: args.applicationId, guildId: member.guildId },
    });

    this.websocket.sendTextNotification({ email: args.userEmail, text: 'Application refused' });
    await this._refresh(member.guildId);
    return true;
  }

  private async _refresh(guildId: number) {
    await this.repository.clearGuildCache({ guildId });
    await this.repository.notifyGuildWithUpdate({ guildId });
  }
}
