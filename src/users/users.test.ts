import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { WebsocketService } from 'src/websocket/websocket.service';
import { UsersGateway } from './users.gateway';

describe('UsersService', () => {
  let service: UsersService;
  let gateway: UsersGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersGateway, UsersService, PrismaService, WebsocketService],
    }).compile();

    service = module.get<UsersService>(UsersService);
    gateway = module.get<UsersGateway>(UsersGateway);
  });

  it('should return value when passing email on handshake auth ', async () => {
    const authEmail = 'auth@email.com';
    const fakeUser = { email: authEmail } as any;
    const findOne = jest.fn().mockResolvedValue(fakeUser);
    jest.spyOn(service, 'findOne').mockImplementation(findOne);
    const returnUser = await gateway.findOne({
      // @ts-expect-error this value can be anything
      handshake: { auth: { email: authEmail } },
    });
    expect(findOne).toHaveBeenCalledWith(authEmail);
    expect(returnUser).toBe(fakeUser);
  });

  it('should return false when not providing an email on handshake auth ', async () => {
    const findOne = jest.fn();
    jest.spyOn(service, 'findOne').mockImplementation(findOne);
    const gatewayResponse = await gateway.findOne({
      // @ts-expect-error this value can be anything
      handshake: { auth: { email: undefined } },
    });
    expect(gatewayResponse).toBe(false);
    expect(findOne).not.toHaveBeenCalled();
  });
});
