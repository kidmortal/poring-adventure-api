import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { Server } from 'http';
import { Logger, UseFilters } from '@nestjs/common';

import { AuthService } from 'src/auth/auth.service';
import { WebsocketService } from './websocket.service';
import { WebsocketExceptionsFilter } from './websocketException.filter';

@UseFilters(WebsocketExceptionsFilter)
@WebSocketGateway({ cors: true })
export class WebsocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;

  private logger = new Logger('Websocket - gateway');

  constructor(
    private readonly websocket: WebsocketService,
    private readonly auth: AuthService,
  ) {}

  async handleConnection(client: Socket) {
    this.logger.debug(`socket ${client.id} connected`);
    this.websocket.wsClients.push(client);
    const accessToken = client.handshake.auth?.acessToken;
    if (!accessToken) {
      client.disconnect();
    }
    const authEmail =
      await this.auth.getAuthenticatedEmailFromToken(accessToken);
    if (!authEmail) {
      return client.disconnect();
    }
    client.handshake.auth.email = authEmail;
    this.websocket.sendMessageToSocket({
      event: 'authenticated',
      email: authEmail,
      payload: {},
    });
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
