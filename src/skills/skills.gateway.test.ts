import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/prisma/prisma.service';
import { SkillsService } from 'src/skills/skills.service';
import { SkillsGateway } from 'src/skills/skills.gateway';
import { UsersService } from 'src/users/users.service';
import { WebsocketService } from 'src/websocket/websocket.service';

describe('Skill Gateway', () => {
  let service: SkillsService;
  let gateway: SkillsGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkillsGateway,
        SkillsService,
        PrismaService,
        UsersService,
        WebsocketService,
      ],
    }).compile();

    service = module.get<SkillsService>(SkillsService);
    gateway = module.get<SkillsGateway>(SkillsGateway);
  });

  describe('learn_skill', () => {
    it('should call learn service and notify user when passing email on handshake auth ', async () => {
      const authEmail = 'auth@email.com';
      const skillId = 10;
      const fakeReturn = {} as any;
      const learn = jest.fn().mockReturnValue(fakeReturn);
      jest.spyOn(service, 'learn').mockImplementation(learn);
      const returnValue = await gateway.learn(skillId, {
        // @ts-expect-error this value can be anything
        handshake: { auth: { email: authEmail } },
      });
      expect(learn).toHaveBeenCalledWith({ email: authEmail, skillId });
      expect(returnValue).toBe(fakeReturn);
    });
  });

  describe('equip_skill', () => {
    it('should call equip service and notify user when passing email on handshake auth ', async () => {
      const authEmail = 'auth@email.com';
      const skillId = 10;
      const fakeReturn = {} as any;
      const learn = jest.fn().mockReturnValue(fakeReturn);
      jest.spyOn(service, 'equip').mockImplementation(learn);
      const returnValue = await gateway.equip(skillId, {
        // @ts-expect-error this value can be anything
        handshake: { auth: { email: authEmail } },
      });
      expect(learn).toHaveBeenCalledWith({ email: authEmail, skillId });
      expect(returnValue).toBe(fakeReturn);
    });
  });

  describe('unequip_skill', () => {
    it('should call unequip service and notify user when passing email on handshake auth ', async () => {
      const authEmail = 'auth@email.com';
      const skillId = 10;
      const fakeReturn = {} as any;
      const learn = jest.fn().mockReturnValue(fakeReturn);
      jest.spyOn(service, 'unequip').mockImplementation(learn);
      const returnValue = await gateway.unequip(skillId, {
        // @ts-expect-error this value can be anything
        handshake: { auth: { email: authEmail } },
      });
      expect(learn).toHaveBeenCalledWith({ email: authEmail, skillId });
      expect(returnValue).toBe(fakeReturn);
    });
  });
});
