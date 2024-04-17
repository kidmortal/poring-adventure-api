import { WebSocketGateway, OnGatewayConnection, OnGatewayDisconnect, WebSocketServer } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { Server } from 'http';
import { Logger, UseFilters } from '@nestjs/common';

import { WebsocketService } from './websocket.service';
import { WebsocketExceptionsFilter } from './websocketException.filter';
import { AuthService } from '../auth/auth.service';

@UseFilters(WebsocketExceptionsFilter)
@WebSocketGateway({ cors: true })
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private logger = new Logger('Websocket - gateway');

  constructor(
    private readonly websocket: WebsocketService,
    private readonly auth: AuthService,
  ) {}

  async handleConnection(client: Socket) {
    const validConnection = await this.auth.validateWebsocketConnection({ socket: client });
    if (validConnection) {
      this.websocket.wsClients.push(client);

      this.websocket.sendMessageToSocket({
        event: 'authenticated',
        email: client.handshake?.auth?.email,
        payload: {},
      });
    } else {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    for (let i = 0; i < this.websocket.wsClients.length; i++) {
      if (this.websocket.wsClients[i] === client) {
        const disconnectedSocket = this.websocket.wsClients.splice(i, 1);
        this.logger.debug(`socket ${disconnectedSocket[0].id} disconnected`);
        break;
      }
    }
  }
}
