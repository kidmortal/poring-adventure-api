import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { TRANSACTION_OPTIONS } from 'src/core/prisma/types/prisma';
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
    // The applicant carries their own applications, and the guild list reads
    // them to know it has already been asked.
    await this.userService.notifyUserUpdateWithProfile({ email: args.userEmail });
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

    const application = await this.prisma.guildApplication.findUnique({
      where: { id: args.applicationId },
      include: { guild: true },
    });
    if (!application || application.guildId !== member.guildId) {
      this.websocket.sendErrorNotification({
        email: args.userEmail,
        text: 'That application is no longer open',
      });
      return false;
    }

    const { userEmail: applicantEmail, guildId } = application;

    // Only the two writes are held in the transaction. Re-reading the applicant,
    // pushing sockets and calling the notification service are all far slower
    // than the writes and none of them need to be atomic with them.
    await this.prisma.$transaction(async (tx) => {
      // Joining one guild withdraws every other application the player has open.
      await tx.guildApplication.deleteMany({ where: { userEmail: applicantEmail } });
      await tx.guildMember.create({ data: { guildId, userEmail: applicantEmail } });
    }, TRANSACTION_OPTIONS);

    this.websocket.sendTextNotification({ email: args.userEmail, text: 'Application accepted' });
    await this.userService.notifyUserUpdateWithProfile({ email: applicantEmail });
    await this._refresh(guildId);

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
    return true;
  }

  async refuseGuildApplication(args: { userEmail: string; applicationId: number }) {
    const member = await this.permissions.requireMember({
      userEmail: args.userEmail,
      level: GuildPermission.MANAGE_APPLICATIONS,
    });
    if (!member) return false;

    const refused = await this.prisma.guildApplication.delete({
      where: { id: args.applicationId, guildId: member.guildId },
    });

    // The applicant may apply again, so their copy has to lose it too.
    await this.userService.notifyUserUpdateWithProfile({ email: refused.userEmail });
    this.websocket.sendTextNotification({ email: args.userEmail, text: 'Application refused' });
    await this._refresh(member.guildId);
    return true;
  }

  private async _refresh(guildId: number) {
    await this.repository.clearGuildCache({ guildId });
    await this.repository.notifyGuildWithUpdate({ guildId });
  }
}
