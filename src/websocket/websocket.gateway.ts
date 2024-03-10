import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { Server } from 'http';
import { Logger } from '@nestjs/common';

import { AuthService } from 'src/auth/auth.service';
import { WebsocketService } from './websocket.service';
import { UsersService } from 'src/users/users.service';

@WebSocketGateway({ cors: true })
export class WebsocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;

  private logger = new Logger('Websocket');

  constructor(
    private readonly websocket: WebsocketService,
    private readonly auth: AuthService,
    private readonly user: UsersService,
  ) {}

  @SubscribeMessage('get_all_sockets')
  async findOne(@ConnectedSocket() client: Socket) {
    this.logger.debug('get_all_sockets');
    const email = client.handshake.auth.email;
    const isAdmin = await this.user.isAdmin(email);
    if (!isAdmin) {
      return this.websocket.breakUserConnection(email);
    }
    return this.websocket.getAllSockets();
  }

  @SubscribeMessage('message_socket')
  async sendMessage(
    @MessageBody()
    args: {
      to: string;
      message: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.debug('message_socket');
    const email = client.handshake.auth.email;
    const isAdmin = await this.user.isAdmin(email);
    if (!isAdmin) {
      return this.websocket.breakUserConnection(email);
    }
    return this.websocket.sendTextNotification(args.to, args.message);
  }

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
