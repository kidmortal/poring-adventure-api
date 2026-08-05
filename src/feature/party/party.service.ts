import { Injectable } from '@nestjs/common';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { FullParty, PartyRepository } from './party.repository';
import { PartyNotifier } from './party.notifier';
import { PartyState } from './party.state';
import { UsersRepository } from 'src/feature/users/users.repository';

const MAX_PARTY_MEMBERS = 4;

/**
 * Party commands. Reads and caching live in PartyRepository, socket pushes in
 * PartyNotifier, and the open/chat state in PartyState.
 */
@Injectable()
export class PartyService {
  constructor(
    private readonly websocket: WebsocketService,
    private readonly repository: PartyRepository,
    private readonly notifier: PartyNotifier,
    private readonly state: PartyState,
    private readonly usersRepository: UsersRepository,
  ) {}

  /**
   * A member's cached profile carries their `partyId`, and every entrance to a
   * fight reads it from there. Leaving it behind after the party is gone sent
   * the next battle looking for a party that no longer exists — which is not a
   * stale screen but a crash, since nothing downstream expected a null one.
   */
  private async _forgetPartyOnUsers(emails: string[]) {
    for await (const email of emails) {
      await this.usersRepository.clearUserCache({ email });
    }
  }

  async create(args: { email: string }) {
    if (await this.repository.userHasParty({ email: args.email })) return false;

    const newParty = await this.repository.createParty({ email: args.email });
    await this.notifier.partyWithData({ partyId: newParty.id });
    return true;
  }

  async findOne(args: { partyId: number; email: string }) {
    const party = await this.repository.getPartyFromId({ partyId: args.partyId });
    if (!party) {
      this.notifier.userWithNoParty(args);
      return false;
    }

    await this.notifier.memberWithData({ partyId: args.partyId, memberEmail: args.email });
    this.notifier.memberWithStatus({ memberEmail: args.email, partyId: args.partyId });
    return true;
  }

  async openParty(args: { email: string; partyId: number }) {
    const party = await this._getOwnedParty({ userEmail: args.email, partyId: args.partyId });
    if (!party) return false;

    this.state.open(party.id);
    await this.notifier.partyWithStatus({ partyId: args.partyId });
    return true;
  }

  async closeParty(args: { email: string; partyId: number }) {
    const party = await this._getOwnedParty({ userEmail: args.email, partyId: args.partyId });
    if (!party) return false;

    this.state.close(party.id);
    await this.notifier.partyWithStatus({ partyId: args.partyId });
    return true;
  }

  async invite(args: { partyId: number; userEmail: string; invitedEmail: string }) {
    const ownedParty = await this._getOwnedParty({ partyId: args.partyId, userEmail: args.userEmail });
    if (!ownedParty || ownedParty.members.length >= MAX_PARTY_MEMBERS) {
      this.websocket.sendErrorNotification({
        email: args.userEmail,
        text: 'You must create a party before sending an invitation.',
      });
      return false;
    }

    this.notifier.sendInvite({ email: args.invitedEmail, party: ownedParty });
    this.websocket.sendTextNotification({ email: args.userEmail, text: 'Invited to group.' });
    return true;
  }

  async joinParty(args: { email: string; partyId: number }) {
    if (!this.state.isOpen(args.partyId)) {
      this.websocket.sendErrorNotification({ email: args.email, text: 'Party is closed.' });
      return false;
    }

    const joiningParty = await this.repository.getPartyFromId({ partyId: args.partyId });
    if (!joiningParty || joiningParty.members.length >= MAX_PARTY_MEMBERS) return false;

    await this._addUserToParty({ partyId: joiningParty.id, email: args.email });
    return true;
  }

  async quitParty(args: { email: string; partyId: number }) {
    const party = await this.repository.getPartyFromId({ partyId: args.partyId });
    if (!party) return false;

    if (party.leaderEmail === args.email) {
      return this._disbandParty(args);
    }
    await this._removeUserFromParty({ email: args.email, partyId: args.partyId });
    return true;
  }

  /**
   * Hands leadership to another member. Only the current leader may do it, and
   * only to someone already in the party.
   */
  async promote(args: { partyId: number; userEmail: string; promotedEmail: string }) {
    const party = await this.repository.getPartyFromId({ partyId: args.partyId });
    if (!party || party.leaderEmail !== args.userEmail) return false;
    if (args.promotedEmail === args.userEmail) return false;

    const promoted = party.members.find((member) => member.email === args.promotedEmail);
    if (!promoted) return false;

    await this.repository.setPartyLeader({ partyId: args.partyId, leaderEmail: args.promotedEmail });
    await this.repository.clearPartyCache({ partyId: args.partyId });
    await this.notifier.partyWithData({ partyId: args.partyId });
    this.websocket.sendTextNotification({ email: args.promotedEmail, text: 'You are now the party leader' });
    return true;
  }

  async kick(args: { partyId: number; userEmail: string; kickedEmail: string }) {
    const party = await this.repository.getPartyFromId({ partyId: args.partyId });
    if (!party || party.leaderEmail !== args.userEmail) return false;

    await this._removeUserFromParty({ email: args.kickedEmail, partyId: args.partyId });
    return true;
  }

  remove(args: { userEmail: string; partyId: number }) {
    return this._disbandParty({ email: args.userEmail, partyId: args.partyId });
  }

  async sendPartyChatMessage(args: { partyId: number; message: string }) {
    this.state.pushMessage(args);
    await this.notifier.partyWithStatus({ partyId: args.partyId });
    return true;
  }

  async getAllOpenParties() {
    const parties: FullParty[] = [];
    for await (const partyId of this.state.listOpenPartyIds()) {
      parties.push(await this.repository.getPartyFromId({ partyId }));
    }
    return parties;
  }

  /** Resolves the party only when the caller leads it, repairing a missing membership row. */
  private async _getOwnedParty(args: { userEmail: string; partyId: number }) {
    const party = await this.repository.getPartyFromId({ partyId: args.partyId });
    if (!party || party.leaderEmail !== args.userEmail) return undefined;

    const isMember = party.members.some((member) => member.email === args.userEmail);
    if (!isMember) {
      await this._addUserToParty({ partyId: party.id, email: args.userEmail });
    }
    return party;
  }

  private async _addUserToParty(args: { partyId: number; email: string }) {
    const joinedUser = await this.repository.setUserParty({ email: args.email, partyId: args.partyId });
    await this.repository.clearPartyCache({ partyId: args.partyId });
    await this.notifier.memberJoined({ partyId: args.partyId, playerName: joinedUser.name });
    await this.notifier.partyWithData({ partyId: args.partyId });
  }

  private async _removeUserFromParty(args: { email: string; partyId: number }) {
    const leftUser = await this.repository.setUserParty({ email: args.email, partyId: null });
    await this.repository.clearPartyCache({ partyId: args.partyId });
    // Or the next fight they start would still gather the party they just left.
    await this._forgetPartyOnUsers([args.email]);
    this.notifier.userWithNoParty({ email: args.email });
    await this.notifier.memberLeft({ partyId: args.partyId, playerName: leftUser.name });
    await this.notifier.partyWithData({ partyId: args.partyId });
  }

  private async _disbandParty(args: { email: string; partyId: number }) {
    const ownedParty = await this._getOwnedParty({ userEmail: args.email, partyId: args.partyId });
    if (!ownedParty) return false;

    await this.repository.deletePartyOwnedBy({ email: args.email });
    await this.repository.clearPartyCache({ partyId: ownedParty.id });
    await this._forgetPartyOnUsers(ownedParty.members.map((member) => member.email));
    ownedParty.members.forEach((member) => this.notifier.userWithNoParty({ email: member.email }));
    this.state.forget(ownedParty.id);
    return true;
  }
}
