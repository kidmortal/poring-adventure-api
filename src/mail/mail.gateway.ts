import {
  WebSocketGateway,
  SubscribeMessage,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { MailService } from './mail.service';

@WebSocketGateway()
export class MailGateway {
  constructor(private readonly mailService: MailService) {}
  private logger = new Logger('Websocket - mail');

  @SubscribeMessage('get_all_notification')
  findAll(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    if (!email) return false;
    this.logger.debug('get_all_notification');
    return this.mailService.findAll({ userEmail: email });
  }
}
