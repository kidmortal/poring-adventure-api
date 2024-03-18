import { Injectable } from '@nestjs/common';
import { Party } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { WebsocketService } from 'src/websocket/websocket.service';

@Injectable()
export class PartyService {
  constructor(
    private readonly websocket: WebsocketService,
    private readonly prisma: PrismaService,
  ) {}

  async sendPartyInviteNotification(args: { party: Party; email: string }) {
    if (args.party) {
      this.websocket.sendMessageToSocket({
        email: args.email,
        event: 'party_invite',
        payload: args.party,
      });
      return true;
    }
  }

  async notifyUserWithNoParty(args: { email: string }) {
    this.websocket.sendMessageToSocket({
      email: args.email,
      event: 'party_data',
      payload: null,
    });
  }

  async notifyPartyWithData(args: { email: string }) {
    const party = await this.getUserParty(args);
    if (party) {
      party.members.forEach((member) => {
        this.websocket.sendMessageToSocket({
          email: member.email,
          event: 'party_data',
          payload: party,
        });
      });
      return party;
    }
    return false;
  }
  async notifyPartyJoinMember(args: {
    email: string;
    joinedPlayerName: string;
  }) {
    const party = await this.getUserParty(args);
    if (party) {
      party.members.forEach((member) => {
        this.websocket.sendMessageToSocket({
          email: member.email,
          event: 'notification',
          payload: `${args.joinedPlayerName} Joined the party`,
        });
      });
      return party;
    }
    return false;
  }

  async notifyPartyLeftMember(args: { email: string; leftPlayerName: string }) {
    const party = await this.getUserParty(args);
    if (party) {
      party.members.forEach((member) => {
        this.websocket.sendMessageToSocket({
          email: member.email,
          event: 'notification',
          payload: `${args.leftPlayerName} Left the party`,
        });
      });
      return party;
    }
    return false;
  }

  async create(args: { email: string }) {
    const userHasParty = await this.userHasParty({ email: args.email });
    if (userHasParty) return false;

    try {
      await this.prisma.party.create({
        data: {
          leaderEmail: args.email,
          members: { connect: { email: args.email } },
        },
      });
      this.notifyPartyWithData(args);
      return true;
    } catch (error) {
      return false;
    }
  }

  async findOne(args: { email: string }) {
    const party = await this.notifyPartyWithData(args);
    if (!party) {
      this.notifyUserWithNoParty(args);
      return false;
    }
    return true;
  }

  async getFullParty(leaderEmail: string) {
    return this.prisma.party.findUnique({
      where: {
        leaderEmail: leaderEmail,
      },
      include: {
        members: {
          include: {
            appearance: true,
            stats: true,
            buffs: { include: { buff: true } },
            learnedSkills: { include: { skill: true } },
          },
        },
      },
    });
  }

  async invite(args: { leaderEmail: string; invitedEmail: string }) {
    const ownedParty = await this.prisma.party.findUnique({
      where: {
        leaderEmail: args.leaderEmail,
      },
      include: {
        members: true,
      },
    });
    if (ownedParty) {
      this.sendPartyInviteNotification({
        email: args.invitedEmail,
        party: ownedParty,
      });
      return true;
    }
  }

  async joinParty(args: { email: string; partyId: number }) {
    try {
      const result = await this.prisma.user.update({
        where: { email: args.email },
        data: { partyId: args.partyId },
      });
      if (result) {
        this.notifyPartyJoinMember({
          email: args.email,
          joinedPlayerName: result.name,
        });
        this.notifyPartyWithData({ email: args.email });
        return true;
      }
    } catch (error) {
      return false;
    }
  }

  async quitParty(args: { email: string; partyId }) {
    try {
      const result = await this.prisma.user.update({
        where: { email: args.email },
        data: { partyId: undefined },
      });
      const remainingParty = await this.prisma.party.findUnique({
        where: { id: args.partyId },
      });
      if (result) {
        this.notifyPartyLeftMember({
          email: remainingParty.leaderEmail,
          leftPlayerName: result.name,
        });
        this.notifyUserWithNoParty({ email: args.email });
        return true;
      }
    } catch (error) {
      return false;
    }
  }

  async kick(args: { leaderEmail: string; kickedEmail: string }) {
    const ownedParty = await this.prisma.party.findUnique({
      where: {
        leaderEmail: args.leaderEmail,
      },
    });
    if (ownedParty) {
      await this.prisma.user.update({
        where: { email: args.kickedEmail },
        data: { partyId: null },
      });
      this.notifyPartyWithData({ email: args.leaderEmail });
      this.notifyUserWithNoParty({ email: args.kickedEmail });
      return true;
    }
    return false;
  }

  async remove(args: { email: string }) {
    const ownedParty = await this.prisma.party.findUnique({
      where: {
        leaderEmail: args.email,
      },
      include: {
        members: true,
      },
    });
    if (ownedParty) {
      await this.prisma.party.delete({
        where: {
          leaderEmail: args.email,
        },
      });
      ownedParty.members.forEach((member) =>
        this.notifyUserWithNoParty({ email: member.email }),
      );
      return true;
    }
    return false;
  }

  private async userHasParty(args: { email?: string }) {
    if (!args.email) return false;
    const userParty = await this.prisma.party.findFirst({
      where: { members: { some: { email: args.email } } },
    });
    if (userParty) {
      return true;
    }
    return false;
  }

  private async getUserParty(args: { email?: string }) {
    if (!args.email) return undefined;
    const userParty = await this.prisma.party.findFirst({
      where: { members: { some: { email: args.email } } },
      include: {
        members: {
          include: {
            stats: true,
            appearance: true,
            profession: true,
            learnedSkills: { include: { skill: true } },
          },
        },
      },
    });
    if (userParty) {
      return userParty;
    }
    return undefined;
  }
}
