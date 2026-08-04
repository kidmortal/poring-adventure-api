import { WebSocketGateway, SubscribeMessage, ConnectedSocket } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { Logger, UseFilters, UseGuards } from '@nestjs/common';

import { WebsocketExceptionsFilter } from 'src/core/websocket/websocketException.filter';
import { WebsocketAuthEmailGuard } from 'src/core/websocket/websocket.guard';
import { DungeonService } from './dungeon.service';

/**
 * Reads and the one mutation that does not touch a fight. Entering a dungeon
 * and moving to the next boss both open a battle, so they live on the battle
 * gateway beside the guild boss for the same reason: the battle list is the
 * battle service's, and nothing else may push onto it.
 */
@UseGuards(WebsocketAuthEmailGuard)
@UseFilters(WebsocketExceptionsFilter)
@WebSocketGateway({ cors: true })
export class DungeonGateway {
  constructor(private readonly dungeonService: DungeonService) {}
  private logger = new Logger('Websocket - dungeon');

  @SubscribeMessage('get_dungeons')
  getDungeons() {
    this.logger.debug('get_dungeons');
    return this.dungeonService.findAll();
  }

  @SubscribeMessage('get_dungeon_status')
  getStatus(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug(`get_dungeon_status ${email}`);
    return this.dungeonService.getStatus({ userEmail: email });
  }

  @SubscribeMessage('dungeon_abandon')
  abandon(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug(`dungeon_abandon ${email}`);
    return this.dungeonService.abandon({ userEmail: email });
  }
}
