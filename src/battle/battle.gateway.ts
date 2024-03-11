import {
  WebSocketGateway,
  SubscribeMessage,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { BattleService } from './battle.service';

@WebSocketGateway({ cors: true })
export class BattleGateway {
  constructor(private readonly battleService: BattleService) {}
  private logger = new Logger('Websocket');

  @SubscribeMessage('battle_create')
  async create(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug(`battle_create ${email}`);
    return this.battleService.create(email);
  }

  @SubscribeMessage('battle_update')
  async update(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug(`battle_update ${email}`);
    return this.battleService.getBattleFromUser(email);
  }

  @SubscribeMessage('battle_reset')
  async reset(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug(`battle_reset ${email}`);
    return this.battleService.remove(email);
  }

  @SubscribeMessage('battle_attack')
  async attack(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug(`battle_attack ${email}`);
    return this.battleService.attack(email);
  }
}
