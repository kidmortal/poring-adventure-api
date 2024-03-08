import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ cors: true })
export class BattleGateway {
  private logger = new Logger('Websocket');

  @SubscribeMessage('create_battle')
  async deleteItem(
    @MessageBody() itemId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const email = client.handshake.auth.email;

    if (email) {
      this.logger.debug(`create_battle autorized`);
    } else {
      this.logger.debug(`create_battle forbidden`);
    }
  }
}
