import { Test, TestingModule } from '@nestjs/testing';
import { GuildGateway } from './guild.gateway';
import { GuildService } from './guild.service';

describe('GuildGateway', () => {
  let gateway: GuildGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GuildGateway, GuildService],
    }).compile();

    gateway = module.get<GuildGateway>(GuildGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
