import { WebSocketGateway, SubscribeMessage, ConnectedSocket } from '@nestjs/websockets';
import { Logger, UseFilters, UseGuards } from '@nestjs/common';
import { Socket } from 'socket.io';
import { MailService } from './mail.service';
import { NotificationService } from './notification.service';
import { WebsocketExceptionsFilter } from 'src/core/websocket/websocketException.filter';
import { WebsocketAuthEmailGuard } from 'src/core/websocket/websocket.guard';

@UseGuards(WebsocketAuthEmailGuard)
@WebSocketGateway()
@UseFilters(WebsocketExceptionsFilter)
export class MailGateway {
  constructor(
    private readonly mailService: MailService,
    private readonly notifications: NotificationService,
  ) {}
  private logger = new Logger('Websocket - mail');

  @SubscribeMessage('get_all_mail')
  findAll(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('get_all_mail');
    return this.mailService.findAll({ userEmail: email });
  }
  @SubscribeMessage('claim_all_mail')
  claimAll(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('claim_all_mail');
    return this.mailService.claimAll({ userEmail: email });
  }
  @SubscribeMessage('view_all_mail')
  viewAll(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('view_all_mail');
    return this.mailService.viewAll({ userEmail: email });
  }
  @SubscribeMessage('get_all_notifications')
  getNotifications(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('get_all_notifications');
    return this.notifications.findAll({ userEmail: email });
  }

  @SubscribeMessage('read_all_notifications')
  readNotifications(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('read_all_notifications');
    return this.notifications.readAll({ userEmail: email });
  }

  @SubscribeMessage('delete_all_notifications')
  deleteNotifications(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('delete_all_notifications');
    return this.notifications.deleteAll({ userEmail: email });
  }

  @SubscribeMessage('delete_all_mail')
  deleteAll(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('delete_all_mail');
    return this.mailService.deleteAll({ userEmail: email });
  }
}
