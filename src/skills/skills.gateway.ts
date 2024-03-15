import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { SkillsService } from './skills.service';

import { Logger } from '@nestjs/common';

@WebSocketGateway()
export class SkillsGateway {
  private logger = new Logger('Websocket - skills');
  constructor(private readonly skillsService: SkillsService) {}

  @SubscribeMessage('learn_skill')
  async learn(
    @MessageBody() skillId: number,
    @ConnectedSocket() client: Socket,
  ) {
    const email = client.handshake.auth.email;
    this.logger.debug('learn_skill');
    return this.skillsService.learn({ email, skillId });
  }

  @SubscribeMessage('equip_skill')
  async equip(
    @MessageBody() skillId: number,
    @ConnectedSocket() client: Socket,
  ) {
    const email = client.handshake.auth.email;
    this.logger.debug('equip_skill');
    return this.skillsService.equip({ email, skillId });
  }

  @SubscribeMessage('unequip_skill')
  async unequip(
    @MessageBody() skillId: number,
    @ConnectedSocket() client: Socket,
  ) {
    const email = client.handshake.auth.email;
    this.logger.debug('unequip_skill');
    return this.skillsService.unequip({ email, skillId });
  }
}
