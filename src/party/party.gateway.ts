import {
  WebSocketGateway,
  SubscribeMessage,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { PartyService } from './party.service';
import { Logger } from '@nestjs/common';

@WebSocketGateway()
export class PartyGateway {
  constructor(private readonly partyService: PartyService) {}
  private logger = new Logger('Websocket - party');

  @SubscribeMessage('create_party')
  create(@ConnectedSocket() client: Socket) {
    this.logger.debug('create_party');
    const email = client.handshake.auth.email;
    return this.partyService.create({ email });
  }

  @SubscribeMessage('get_party')
  findOne(@ConnectedSocket() client: Socket) {
    this.logger.debug('get_party');
    const email = client.handshake.auth.email;
    return this.partyService.findOne({ email });
  }

  @SubscribeMessage('remove_party')
  remove(@ConnectedSocket() client: Socket) {
    this.logger.debug('remove_party');
    const email = client.handshake.auth.email;
    return this.partyService.remove({ email });
  }
}
