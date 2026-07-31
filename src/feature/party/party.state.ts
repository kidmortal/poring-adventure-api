import { Injectable } from '@nestjs/common';

/**
 * The volatile side of a party: whether it is listed as open, and its chat log.
 * Deliberately in memory — both are dropped on restart.
 *
 * NOTE: this makes parties single-instance. Moving to more than one API process
 * means backing this with Redis.
 */
@Injectable()
export class PartyState {
  private readonly openParties = new Set<number>();
  private readonly chats = new Map<number, string[]>();

  open(partyId: number) {
    this.openParties.add(partyId);
  }

  close(partyId: number) {
    this.openParties.delete(partyId);
  }

  isOpen(partyId: number) {
    return this.openParties.has(partyId);
  }

  listOpenPartyIds() {
    return [...this.openParties];
  }

  pushMessage(args: { partyId: number; message: string }) {
    const chat = this.chats.get(args.partyId) ?? [];
    chat.push(args.message);
    this.chats.set(args.partyId, chat);
    return chat;
  }

  getChat(partyId: number) {
    return this.chats.get(partyId);
  }

  /** Called when a party is disbanded, so nothing is left behind. */
  forget(partyId: number) {
    this.openParties.delete(partyId);
    this.chats.delete(partyId);
  }
}
