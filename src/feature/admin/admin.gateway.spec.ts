import { Test, TestingModule } from '@nestjs/testing';
import { AdminGateway } from './admin.gateway';
import { AdminService } from './admin.service';

describe('AdminGateway', () => {
  let gateway: AdminGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminGateway, AdminService],
    }).compile();

    gateway = module.get<AdminGateway>(AdminGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
