import { Injectable } from '@nestjs/common';
import { GuildMember } from '@prisma/client';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { GuildRepository } from './guild.repository';

/** Permission levels required by each guild action. */
export const GuildPermission = {
  MANAGE_TASKS: 1,
  MANAGE_APPLICATIONS: 1,
  MANAGE_BLESSINGS: 2,
} as const;

@Injectable()
export class GuildPermissions {
  constructor(
    private readonly repository: GuildRepository,
    private readonly websocket: WebsocketService,
  ) {}

  /**
   * Resolves the caller's membership and checks their level, telling them why
   * when it fails. Returns undefined when the action must not proceed.
   */
  async requireMember(args: { userEmail: string; level: number }): Promise<GuildMember | undefined> {
    const member = await this.repository.getUserGuildMember({ userEmail: args.userEmail });
    if (!member) {
      this._deny(args.userEmail, 'You have no guild');
      return undefined;
    }
    if (member.permissionLevel < args.level) {
      this._deny(
        args.userEmail,
        `Your guild permission isnt high enough (need ${args.level}, have ${member.permissionLevel})`,
      );
      return undefined;
    }
    return member;
  }

  private _deny(email: string, text: string) {
    this.websocket.sendErrorNotification({ email, text });
  }
}
