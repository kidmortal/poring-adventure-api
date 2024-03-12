import { Injectable } from '@nestjs/common';
import { prisma } from 'src/prisma/prisma';
import { WebsocketService } from 'src/websocket/websocket.service';

@Injectable()
export class PartyService {
  constructor(private readonly websocket: WebsocketService) {}
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
      return true;
    }
    return false;
  }

  async create(args: { email: string }) {
    const userHasParty = await this.userHasParty({ email: args.email });
    if (userHasParty) return false;

    return prisma.party.create({
      data: {
        leaderEmail: args.email,
        members: { connect: { email: args.email } },
      },
    });
  }

  findOne(args: { email: string }) {
    return this.notifyPartyWithData(args);
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
