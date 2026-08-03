import { WebSocketGateway, SubscribeMessage, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { Logger, UseFilters, UseGuards } from '@nestjs/common';
import { BattleService } from './battle.service';
import { WebsocketExceptionsFilter } from 'src/core/websocket/websocketException.filter';
import { WebsocketAuthEmailGuard } from 'src/core/websocket/websocket.guard';

@UseGuards(WebsocketAuthEmailGuard)
@UseFilters(WebsocketExceptionsFilter)
@WebSocketGateway({ cors: true })
export class BattleGateway {
  constructor(private readonly battleService: BattleService) {}
  private logger = new Logger('Websocket');

  @SubscribeMessage('battle_create')
  async create(@MessageBody() dto: BattleCreateDto | number, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug(`battle_create ${email}`);
    // Clients on an older bundle send the map id on its own rather than in a dto.
    const mapId = typeof dto === 'number' ? dto : dto?.mapId;
    return this.battleService.create({ userEmail: email, mapId });
  }

  @SubscribeMessage('battle_create_guild_boss')
  async createGuildBoss(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug(`battle_create_guild_boss ${email}`);
    return this.battleService.createGuildBossBattle({ userEmail: email });
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
  @SubscribeMessage('battle_use_item')
  async useItem(@MessageBody() dto: BattleUseItemDto, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug(`battle_use_item ${email}`);
    return this.battleService.useItem({ userEmail: email, inventoryId: dto.inventoryId });
  }

  @SubscribeMessage('battle_cast')
  async cast(@MessageBody() dto: BattleCastDto, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug(`battle_cast ${email}`);
    return this.battleService.cast({
      email,
      skillId: dto.skillId,
      targetName: dto.targetName,
    });
  }
}
