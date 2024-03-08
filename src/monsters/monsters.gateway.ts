import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';

import { Logger } from '@nestjs/common';

@WebSocketGateway({ cors: true })
export class MonsterGateway {
  private logger = new Logger('Websocket');

  @SubscribeMessage('get_monster')
  async deleteItem(
    @MessageBody() itemId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const email = client.handshake.auth.email;

    if (email) {
      this.logger.debug(`get_monster autorized`);
    } else {
      this.logger.debug(`get_monster forbidden`);
    }
  }
}
