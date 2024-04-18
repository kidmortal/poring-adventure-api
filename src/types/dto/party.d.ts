declare type KickFromPartyDto = {
  partyId: number;
  kickedEmail: string;
};
declare type InviteToPartyDto = {
  partyId: number;
  invitedEmail: string;
};

declare type GetPartyDto = {
  partyId: number;
};
declare type JoinPartyDto = {
  partyId: number;
};
declare type RemovePartyDto = {
  partyId: number;
};

declare type QuitPartyDto = {
  partyId: number;
};
