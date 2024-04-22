declare type UnlockBlessingsDto = {
  guildId: number;
};
declare type UpgradeBlessingsDto = {
  blessing: string;
  guildId: number;
};

declare type AcceptGuildApplicationDto = {
  applicationId: number;
};
declare type RefuseGuildApplicationDto = {
  applicationId: number;
};
declare type AcceptGuildTaskDto = {
  taskId: number;
};
declare type CancelGuildTaskDto = {
  taskId: number;
};

declare type ApplyToGuildDto = {
  guildId: number;
};

declare type CreateGuildDto = {
  name: string;
  description: string;
};

declare type UpdateGuildDto = {
  guildId: number;
  name?: string;
  description?: string;
};

declare type DeleteGuildDto = {
  guildId: number;
};

declare type InviteToGuildDto = {
  guildId: number;
  userEmail: string;
};

declare type KickFromGuildDto = {
  guildId: number;
  userEmail: string;
};

declare type PromoteGuildMemberDto = {
  guildId: number;
  userEmail: string;
};

declare type DemoteGuildMemberDto = {
  guildId: number;
  userEmail: string;
};

declare type GetGuildDto = {
  guildId: number;
};

declare type GetGuildMembersDto = {
  guildId: number;
};

declare type GetGuildApplicationsDto = {
  guildId: number;
};

declare type GetGuildTasksDto = {
  guildId: number;
};

declare type GetGuildInvitationsDto = {
  guildId: number;
};

declare type GetGuildBlessingsDto = {
  guildId: number;
};

declare type GetGuildLogsDto = {
  guildId: number;
};

declare type GetGuildStatisticsDto = {
  guildId: number;
};

declare type UnlockBlessingsDto = {
  guildId: number;
};
declare type UpgradeBlessingsDto = {
  blessing: string;
  guildId: number;
};
