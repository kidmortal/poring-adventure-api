import { Injectable } from '@nestjs/common';
import { Party } from '@prisma/client';
import { prisma } from 'src/prisma/prisma';
import { WebsocketService } from 'src/websocket/websocket.service';

@Injectable()
export class PartyService {
  constructor(private readonly websocket: WebsocketService) {}

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

  async create(args: { email: string }) {
    const userHasParty = await this.userHasParty({ email: args.email });
    if (userHasParty) return false;

    try {
      await prisma.party.create({
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

  async invite(args: { leaderEmail: string; invitedEmail: string }) {
    const ownedParty = await prisma.party.findUnique({
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
      const result = await prisma.user.update({
        where: { email: args.email },
        data: { partyId: args.partyId },
      });
      if (result) {
        this.notifyPartyWithData({ email: args.email });
        return true;
      }
    } catch (error) {
      return false;
    }
  }

  async kick(args: { leaderEmail: string; kickedEmail: string }) {
    const ownedParty = await prisma.party.findUnique({
      where: {
        leaderEmail: args.leaderEmail,
      },
    });
    if (ownedParty) {
      await prisma.user.update({
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
    const ownedParty = await prisma.party.findUnique({
      where: {
        leaderEmail: args.email,
      },
    });
    if (ownedParty) {
      await prisma.party.delete({
        where: {
          leaderEmail: args.email,
        },
      });
      return true;
    }
    return false;
  }

  private async userHasParty(args: { email?: string }) {
    if (!args.email) return false;
    const userParty = await prisma.party.findFirst({
      where: { members: { some: { email: args.email } } },
    });
    if (userParty) {
      return true;
    }
    return false;
  }

  private async getUserParty(args: { email?: string }) {
    if (!args.email) return undefined;
    const userParty = await prisma.party.findFirst({
      where: { members: { some: { email: args.email } } },
      include: { members: { include: { stats: true, appearance: true } } },
    });
    if (userParty) {
      return userParty;
    }
    return undefined;
  }
}
