import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Party, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { utils } from 'src/utilities/utils';

type FullParty = Prisma.PartyGetPayload<{
  include: {
    members: {
      include: {
        stats: true;
        appearance: true;
        profession: true;
        learnedSkills: { include: { skill: true } };
        buffs: { include: { buff: true } };
      };
    };
  };
}>;

@Injectable()
export class PartyService {
  private openPartiesIdList: number[] = [];
  private partyChat: { [partyId: string]: string[] } = {};
  constructor(
    private readonly websocket: WebsocketService,
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  async openParty(args: { email: string; partyId: number }) {
    const party = await this._getOwnedParty({ userEmail: args.email, partyId: args.partyId });
    if (party) {
      const alreadyOpen = this._isPartyOpen({ partyId: party.id });
      if (!alreadyOpen) {
        this.openPartiesIdList.push(party.id);
      }
      this._notifyPartyWithStatus({ partyId: args.partyId });

      return true;
    }
    return false;
  }

  async closeParty(args: { email: string; partyId: number }) {
    const party = await this._getOwnedParty({ userEmail: args.email, partyId: args.partyId });
    if (party) {
      utils.removeElementFromList({ list: this.openPartiesIdList, element: party.id });
      this._notifyPartyWithStatus({ partyId: args.partyId });
      return true;
    }
    return false;
  }

  async create(args: { email: string }) {
    const _userHasParty = await this._userHasParty({ email: args.email });
    if (_userHasParty) return false;
    const newParty = await this.prisma.party.create({
      data: { leaderEmail: args.email, members: { connect: { email: args.email } } },
    });
    this._notifyPartyWithData({ partyId: newParty.id });
  }

  async findOne(args: { partyId: number; email: string }) {
    const party = await this._notifyPartyMemberWithData({ partyId: args.partyId, memberEmail: args.email });
    if (!party) {
      this._notifyUserWithNoParty(args);
      return false;
    }
    this._notifyPartyMemberWithStatus({ memberEmail: args.email, partyId: args.partyId });
    return true;
  }

  async invite(args: { partyId: number; userEmail: string; invitedEmail: string }) {
    const ownedParty = await this._getOwnedParty({ partyId: args.partyId, userEmail: args.userEmail });
    if (ownedParty && ownedParty.members.length < 4) {
      this._sendPartyInviteNotification({ email: args.invitedEmail, party: ownedParty });
      this.websocket.sendTextNotification({ email: args.userEmail, text: 'Invited to group.' });
      return true;
    }

    this.websocket.sendErrorNotification({
      email: args.userEmail,
      text: 'You must create a party before sending an invitation.',
    });

    return false;
  }

  async joinParty(args: { email: string; partyId: number }) {
    const joiningParty = await this.getPartyFromId({ partyId: args.partyId });
    if (joiningParty && joiningParty.members.length < 4) {
      await this._addUserToParty({ partyId: joiningParty.id, email: args.email });
    }
    return false;
  }

  async quitParty(args: { email: string; partyId: number }) {
    const party = await this.getPartyFromId({ partyId: args.partyId });
    if (party) {
      await this._removeUserFromParty({ email: args.email });
    }
  }

  async kick(args: { partyId: number; userEmail: string; kickedEmail: string }) {
    const ownedParty = await this.getPartyFromId({ partyId: args.partyId });
    if (ownedParty) {
      if (ownedParty.leaderEmail !== args.userEmail) {
        return false;
      }
      await this._removeUserFromParty({ email: args.kickedEmail });
      return true;
    }
    return false;
  }

  async remove(args: { userEmail: string; partyId: number }) {
    const ownedParty = await this._getOwnedParty(args);
    if (ownedParty) {
      await this.prisma.party.delete({ where: { leaderEmail: args.userEmail } });
      ownedParty.members.forEach((member) => this._notifyUserWithNoParty({ email: member.email }));
      return true;
    }
    return false;
  }
  async sendPartyChatMessage(args: { partyId: number; message: string }) {
    await this._pushMessageToPartyChat(args);
    return true;
  }

  async getAllOpenParties() {
    const openParties: FullParty[] = [];
    for await (const partyId of this.openPartiesIdList) {
      const party = await this.getPartyFromId({ partyId });
      openParties.push(party);
    }
    return openParties;
  }

  private async _pushMessageToPartyChat(args: { partyId: number; message: string }) {
    let chat = this.partyChat[args.partyId];
    if (!chat) {
      this.partyChat[args.partyId] = [];
      chat = this.partyChat[args.partyId];
    }
    chat.push(args.message);
    this._notifyPartyWithStatus({ partyId: args.partyId });
  }

  private _isPartyOpen(args: { partyId: number }) {
    const alreadyOpen = this.openPartiesIdList.find((partyId) => partyId === args.partyId);
    if (alreadyOpen) return true;
    return false;
  }

  private async _getOwnedParty(args: { userEmail: string; partyId: number }) {
    const party = await this.getPartyFromId({ partyId: args.partyId });
    if (party && party.leaderEmail === args.userEmail) {
      return party;
    }
    return false;
  }

  private async _sendPartyInviteNotification(args: { party: Party; email: string }): Promise<boolean> {
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

  private async _notifyUserWithNoParty(args: { email: string }): Promise<boolean> {
    this.websocket.sendMessageToSocket({
      email: args.email,
      event: 'party_data',
      payload: null,
    });
    return true;
  }

  private async _notifyPartyMemberWithData(args: { partyId?: number; memberEmail: string }): Promise<boolean> {
    const party = await this.getPartyFromId(args);
    if (party) {
      this.websocket.sendMessageToSocket({
        email: args.memberEmail,
        event: 'party_data',
        payload: party,
      });
      return true;
    }
    return false;
  }

  private async _notifyPartyWithData(args: { partyId?: number }): Promise<boolean> {
    const party = await this.getPartyFromId(args);
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
  private async _notifyPartyJoinMember(args: { partyId?: number; joinedPlayerName: string }): Promise<boolean> {
    const party = await this.getPartyFromId(args);
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

  private async _notifyPartyLeftMember(args: { partyId?: number; leftPlayerName: string }): Promise<boolean> {
    const party = await this.getPartyFromId(args);
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
    const userParty = await this.prisma.party.findFirst({ where: { members: { some: { email: args.email } } } });
    if (userParty) {
      return true;
    }
    return false;
  }

  private async _removeUserFromParty(args: { email?: string }) {
    const leftUser = await this.prisma.user.update({ where: { email: args.email }, data: { partyId: null } });
    this._notifyUserWithNoParty({ email: args.email });
    this._notifyPartyLeftMember({ partyId: leftUser.partyId, leftPlayerName: leftUser.name });
    this._notifyPartyWithData({ partyId: leftUser.partyId });
  }

  private async _notifyPartyWithStatus(args: { partyId?: number }) {
    const party = await this.getPartyFromId({ partyId: args.partyId });
    if (!party) return false;

    party.members.forEach((member) => {
      this._notifyPartyMemberWithStatus({ memberEmail: member.email, partyId: args.partyId });
    });
  }
  private async _notifyPartyMemberWithStatus(args: { partyId?: number; memberEmail: string }): Promise<boolean> {
    const chat = this.partyChat[args.partyId];
    const isPartyOpen = this._isPartyOpen({ partyId: args.partyId });
    this.websocket.sendMessageToSocket({
      email: args.memberEmail,
      event: 'party_status',
      payload: { chat, isPartyOpen },
    });

    return true;
  }

  private async _addUserToParty(args: { partyId: number; email?: string }) {
    const joinedUser = await this.prisma.user.update({ where: { email: args.email }, data: { partyId: args.partyId } });
    this._notifyPartyJoinMember({ partyId: joinedUser.partyId, joinedPlayerName: joinedUser.name });
    this._notifyPartyWithData({ partyId: joinedUser.partyId });
  }

  async getPartyFromId(args: { partyId?: number }): Promise<FullParty> {
    const cacheKey = `party_id_${args.partyId}`;
    const cachedParty = await this.cache.get(cacheKey);
    if (cachedParty) return cachedParty as FullParty;
    const party = await this.prisma.party.findFirst({
      where: { id: args.partyId },
      include: {
        members: {
          include: {
            stats: true,
            appearance: true,
            profession: true,
            learnedSkills: { include: { skill: true } },
            buffs: { include: { buff: true } },
          },
        },
      },
    });
    await this.cache.set(cacheKey, party);
    return party;
  }
}
