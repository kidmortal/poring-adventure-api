import {
  WebSocketGateway,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { Logger, UseFilters } from '@nestjs/common';
import { BattleService } from './battle.service';
import { WebsocketExceptionsFilter } from 'src/core/websocket/websocketException.filter';

@UseFilters(WebsocketExceptionsFilter)
@WebSocketGateway({ cors: true })
export class BattleGateway {
  constructor(private readonly battleService: BattleService) {}
  private logger = new Logger('Websocket');

  @SubscribeMessage('battle_create')
  async create(
    @MessageBody() mapId: number,
    @ConnectedSocket() client: Socket,
  ) {
    const email = client.handshake.auth.email;
    this.logger.debug(`battle_create ${email}`);
    return this.battleService.create({ userEmail: email, mapId });
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
    return this.battleService.finishBattle({ userEmail: email });
  }

  @SubscribeMessage('battle_attack')
  async attack(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug(`battle_attack ${email}`);
    return this.battleService.attack(email);
  }
  @SubscribeMessage('battle_cast')
  async cast(
    @MessageBody() params: { skillId: number; targetName?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const email = client.handshake.auth.email;
    this.logger.debug(`battle_cast ${email}`);
    return this.battleService.cast({
      email,
      skillId: params.skillId,
      targetName: params.targetName,
    });
  }
}
