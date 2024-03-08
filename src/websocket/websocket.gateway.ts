import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { Server } from 'http';
import { Logger } from '@nestjs/common';

import { AuthService } from 'src/auth/auth.service';

@WebSocketGateway({ cors: true })
export class WebsocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  wsClients: Socket[] = [];
  private logger = new Logger('Websocket');

  constructor(private readonly auth: AuthService) {}

  broadcast(event, message: any) {
    for (const c of this.wsClients) {
      c.emit(event, message);
    }
  }

  async handleConnection(client: Socket) {
    this.logger.debug(`socket ${client.id} connected`);
    this.wsClients.push(client);
    const accessToken = client.handshake.auth?.acessToken;
    if (!accessToken) {
      client.disconnect();
    }
    const authEmail =
      await this.auth.getAuthenticatedEmailFromToken(accessToken);
    if (!authEmail) {
      client.disconnect();
    }
    client.handshake.auth.email = authEmail;

    client.emit('message', { msg: `vai tomar no cu ${authEmail}` });
  }

  handleDisconnect(client: Socket) {
    for (let i = 0; i < this.wsClients.length; i++) {
      if (this.wsClients[i] === client) {
        const disconnectedSocket = this.wsClients.splice(i, 1);
        this.logger.debug(`socket ${disconnectedSocket[0].id} disconnected`);
        break;
      }
    }
  }
}
