import {
  WebSocketGateway,
  SubscribeMessage,
  ConnectedSocket,
} from '@nestjs/websockets';
import { NotificationService } from './notification.service';
import { Logger } from '@nestjs/common';
import { Socket } from 'socket.io';

@WebSocketGateway()
export class NotificationGateway {
  constructor(private readonly notificationService: NotificationService) {}
  private logger = new Logger('Websocket - notification');

  @SubscribeMessage('get_all_notification')
  findAll(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    if (!email) return false;
    this.logger.debug('get_all_notification');
    return this.notificationService.findAll({ userEmail: email });
  }
}
