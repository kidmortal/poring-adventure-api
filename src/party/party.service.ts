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

  async create(args: { email: string }) {
    const _userHasParty = await this._userHasParty({ email: args.email });
    if (_userHasParty) return false;

    try {
      await this.prisma.party.create({
        data: {
          leaderEmail: args.email,
          members: { connect: { email: args.email } },
        },
      });
      this._notifyPartyWithData(args);
      return true;
    } catch (error) {
      return false;
    }
  }

  async findOne(args: { email: string }) {
    const party = await this._notifyPartyWithData(args);
    if (!party) {
      this._notifyUserWithNoParty(args);
      return false;
    }
    return true;
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
    if (ownedParty && ownedParty.members.length < 4) {
      this._sendPartyInviteNotification({
        email: args.invitedEmail,
        party: ownedParty,
      });
      return true;
    }

    this.websocket.sendErrorNotification({
      email: args.leaderEmail,
      text: 'You must create a party before inviting.',
    });

    return false;
  }

  async joinParty(args: { email: string; partyId: number }) {
    const joiningParty = await this._getPartyFromId({ partyId: args.partyId });
    if (joiningParty && joiningParty.members.length < 4) {
      try {
        const result = await this.prisma.user.update({
          where: { email: args.email },
          data: { partyId: args.partyId },
        });
        if (result) {
          this._notifyPartyJoinMember({
            email: args.email,
            joinedPlayerName: result.name,
          });
          this._notifyPartyWithData({ email: args.email });
          return true;
        }
      } catch (error) {
        return false;
      }
    }
    return false;
  }

  async quitParty(args: { email: string; partyId }) {
    const result = await this.prisma.user.update({
      where: { email: args.email },
      data: { partyId: undefined },
    });
    const remainingParty = await this.prisma.party.findUnique({
      where: { id: args.partyId },
    });
    if (result) {
      this._notifyPartyLeftMember({
        email: remainingParty.leaderEmail,
        leftPlayerName: result.name,
      });
      this._notifyUserWithNoParty({ email: args.email });
      return true;
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
      this._notifyPartyWithData({ email: args.leaderEmail });
      this._notifyUserWithNoParty({ email: args.kickedEmail });
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
        this._notifyUserWithNoParty({ email: member.email }),
      );
      return true;
    }
    return false;
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
            learnedSkills: { include: { skill: { include: { buff: true } } } },
          },
        },
      },
    });
  }

  private async _sendPartyInviteNotification(args: {
    party: Party;
    email: string;
  }): Promise<boolean> {
    if (args.party) {
      this.websocket.sendMessageToSocket({
        email: args.email,
        event: 'party_invite',
        payload: args.party,
      });
      return true;
    }
    return false;
  }

  private async _notifyUserWithNoParty(args: {
    email: string;
  }): Promise<boolean> {
    this.websocket.sendMessageToSocket({
      email: args.email,
      event: 'party_data',
      payload: null,
    });
    return true;
  }

  private async _notifyPartyWithData(args: {
    email: string;
  }): Promise<boolean> {
    const party = await this._getUserParty(args);
    if (party) {
      party.members.forEach((member) => {
        this.websocket.sendMessageToSocket({
          email: member.email,
          event: 'party_data',
          payload: party,
        });
      });
      return true;
    }
    return false;
  }
  private async _notifyPartyJoinMember(args: {
    email: string;
    joinedPlayerName: string;
  }): Promise<boolean> {
    const party = await this._getUserParty(args);
    if (party) {
      party.members.forEach((member) => {
        this.websocket.sendMessageToSocket({
          email: member.email,
          event: 'notification',
          payload: `${args.joinedPlayerName} Joined the party`,
        });
      });
      return true;
    }
    return false;
  }

  private async _notifyPartyLeftMember(args: {
    email: string;
    leftPlayerName: string;
  }): Promise<boolean> {
    const party = await this._getUserParty(args);
    if (party) {
      party.members.forEach((member) => {
        this.websocket.sendMessageToSocket({
          email: member.email,
          event: 'notification',
          payload: `${args.leftPlayerName} Left the party`,
        });
      });
      return true;
    }
    return false;
  }

  private async _userHasParty(args: { email?: string }): Promise<boolean> {
    if (!args.email) return false;
    const userParty = await this.prisma.party.findFirst({
      where: { members: { some: { email: args.email } } },
    });
    if (userParty) {
      return true;
    }
    return false;
  }

  private async _getUserParty(args: { email?: string }) {
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

  private async _getPartyFromId(args: { partyId?: number }) {
    return this.prisma.party.findUnique({
      where: { id: args.partyId },
      include: { members: true },
    });
  }
}
