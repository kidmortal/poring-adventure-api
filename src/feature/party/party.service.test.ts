import { Test, TestingModule } from '@nestjs/testing';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { PartyService } from './party.service';
import { PartyRepository } from './party.repository';
import { PartyNotifier } from './party.notifier';
import { PartyState } from './party.state';

describe('Party Service', () => {
  let service: PartyService;
  let repository: {
    getPartyFromId: jest.Mock;
    setPartyLeader: jest.Mock;
    clearPartyCache: jest.Mock;
    setUserParty: jest.Mock;
  };
  let notifier: { partyWithData: jest.Mock };

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
    };
    notifier = { partyWithData: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartyService,
        { provide: PartyRepository, useValue: repository },
        { provide: PartyNotifier, useValue: notifier },
        { provide: PartyState, useValue: { isOpen: jest.fn(), pushMessage: jest.fn() } },
        {
          provide: WebsocketService,
          useValue: { sendTextNotification: jest.fn(), sendErrorNotification: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<PartyService>(PartyService);
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
