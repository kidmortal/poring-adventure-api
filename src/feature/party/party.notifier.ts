import { Injectable } from '@nestjs/common';
import { Party } from '@prisma/client';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { PartyRepository } from './party.repository';
import { PartyState } from './party.state';

/** Everything the party feature pushes over the socket, in one place. */
@Injectable()
export class PartyNotifier {
  constructor(
    private readonly websocket: WebsocketService,
    private readonly repository: PartyRepository,
    private readonly state: PartyState,
  ) {}

  sendInvite(args: { party: Party; email: string }) {
    if (!args.party) return false;
    this.websocket.sendMessageToSocket({
      email: args.email,
      event: 'party_invite',
      payload: args.party,
    });
    return true;
  }

  userWithNoParty(args: { email: string }) {
    this.websocket.sendMessageToSocket({ email: args.email, event: 'party_data', payload: null });
    return true;
  }

  async memberWithData(args: { partyId?: number; memberEmail: string }) {
    const party = await this.repository.getPartyFromId(args);
    const isMember = party?.members.some((member) => member.email === args.memberEmail);
    if (!isMember) return false;

    this.websocket.sendMessageToSocket({
      email: args.memberEmail,
      event: 'party_data',
      payload: party,
    });
    return true;
  }

  async partyWithData(args: { partyId?: number }) {
    const party = await this.repository.getPartyFromId(args);
    if (!party) return false;

    party.members.forEach((member) =>
      this.websocket.sendMessageToSocket({
        email: member.email,
        event: 'party_data',
        payload: party,
      }),
    );
    return true;
  }

  memberWithStatus(args: { partyId?: number; memberEmail: string }) {
    this.websocket.sendMessageToSocket({
      email: args.memberEmail,
      event: 'party_status',
      payload: {
        chat: this.state.getChat(args.partyId),
        isPartyOpen: this.state.isOpen(args.partyId),
      },
    });
    return true;
  }

  async partyWithStatus(args: { partyId?: number }) {
    const party = await this.repository.getPartyFromId(args);
    if (!party) return false;

    party.members.forEach((member) => this.memberWithStatus({ memberEmail: member.email, partyId: args.partyId }));
    return true;
  }

  memberJoined(args: { partyId?: number; playerName: string }) {
    return this._announce(args.partyId, `${args.playerName} Joined the party`);
  }

  memberLeft(args: { partyId?: number; playerName: string }) {
    return this._announce(args.partyId, `${args.playerName} Left the party`);
  }

  private async _announce(partyId: number | undefined, text: string) {
    const party = await this.repository.getPartyFromId({ partyId });
    if (!party) return false;

    party.members.forEach((member) =>
      this.websocket.sendMessageToSocket({
        email: member.email,
        event: 'notification',
        payload: text,
      }),
    );
    return true;
  }
}
