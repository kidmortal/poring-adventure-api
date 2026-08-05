import { Test, TestingModule } from '@nestjs/testing';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { PartyService } from './party.service';
import { PartyRepository } from './party.repository';
import { PartyNotifier } from './party.notifier';
import { PartyState } from './party.state';
import { UsersRepository } from 'src/feature/users/users.repository';

describe('Party Service', () => {
  let service: PartyService;
  let repository: {
    getPartyFromId: jest.Mock;
    setPartyLeader: jest.Mock;
    clearPartyCache: jest.Mock;
    setUserParty: jest.Mock;
    deletePartyOwnedBy: jest.Mock;
  };
  let notifier: { partyWithData: jest.Mock; userWithNoParty: jest.Mock; memberLeft: jest.Mock };
  let users: { clearUserCache: jest.Mock };

  const LEADER = 'leader@test.com';
  const MEMBER = 'member@test.com';

  const party = {
    id: 1,
    leaderEmail: LEADER,
    members: [
      { email: LEADER, name: 'Leader' },
      { email: MEMBER, name: 'Member' },
    ],
  };

  beforeEach(async () => {
    repository = {
      getPartyFromId: jest.fn().mockResolvedValue(party),
      setPartyLeader: jest.fn().mockResolvedValue({}),
      clearPartyCache: jest.fn(),
      setUserParty: jest.fn().mockResolvedValue({ name: 'Member' }),
      deletePartyOwnedBy: jest.fn().mockResolvedValue({}),
    };
    notifier = { partyWithData: jest.fn(), userWithNoParty: jest.fn(), memberLeft: jest.fn() };
    users = { clearUserCache: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartyService,
        { provide: PartyRepository, useValue: repository },
        { provide: PartyNotifier, useValue: notifier },
        { provide: PartyState, useValue: { isOpen: jest.fn(), pushMessage: jest.fn(), forget: jest.fn() } },
        { provide: UsersRepository, useValue: users },
        {
          provide: WebsocketService,
          useValue: { sendTextNotification: jest.fn(), sendErrorNotification: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<PartyService>(PartyService);
  });

  describe('leaving a party', () => {
    /**
     * The profile cache carries the member's partyId, and every entrance to a
     * fight reads it from there. Left behind, it sent the next battle looking
     * for a party that had been disbanded — a null dereference rather than a
     * stale screen.
     */
    it("drops the leaver's cached profile, which still says they are in one", async () => {
      repository.setUserParty.mockResolvedValue({ name: 'Member' });

      await service.quitParty({ email: MEMBER, partyId: 1 });

      expect(repository.setUserParty).toHaveBeenCalledWith({ email: MEMBER, partyId: null });
      expect(users.clearUserCache).toHaveBeenCalledWith({ email: MEMBER });
    });

    it("drops every member's when the leader disbands it", async () => {
      await service.quitParty({ email: LEADER, partyId: 1 });

      expect(users.clearUserCache).toHaveBeenCalledWith({ email: LEADER });
      expect(users.clearUserCache).toHaveBeenCalledWith({ email: MEMBER });
    });
  });

  describe('promote', () => {
    it('hands leadership to another member', async () => {
      const result = await service.promote({ partyId: 1, userEmail: LEADER, promotedEmail: MEMBER });

      expect(repository.setPartyLeader).toHaveBeenCalledWith({ partyId: 1, leaderEmail: MEMBER });
      expect(notifier.partyWithData).toHaveBeenCalledWith({ partyId: 1 });
      expect(result).toBe(true);
    });

    it('refuses anyone who does not lead the party', async () => {
      const result = await service.promote({ partyId: 1, userEmail: MEMBER, promotedEmail: MEMBER });

      expect(result).toBe(false);
      expect(repository.setPartyLeader).not.toHaveBeenCalled();
    });

    it('refuses someone who is not in the party', async () => {
      const result = await service.promote({ partyId: 1, userEmail: LEADER, promotedEmail: 'stranger@test.com' });

      expect(result).toBe(false);
      expect(repository.setPartyLeader).not.toHaveBeenCalled();
    });

    it('refuses promoting yourself, which changes nothing', async () => {
      const result = await service.promote({ partyId: 1, userEmail: LEADER, promotedEmail: LEADER });

      expect(result).toBe(false);
    });
  });
});
