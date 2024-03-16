import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { WebsocketService } from 'src/websocket/websocket.service';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, PrismaService, WebsocketService],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', async () => {
    const result = { email: 'kidmortal@gmail.com' } as any;
    jest.spyOn(service, 'findOne').mockImplementation(() => result);
    const returnValue = await service.findOne('kidmortal@gmail.com');
    expect(returnValue).toBe(result);
  });
});
