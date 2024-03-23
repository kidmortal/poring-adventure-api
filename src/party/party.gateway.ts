import {
  WebSocketGateway,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { PartyService } from './party.service';
import { Logger, UseFilters } from '@nestjs/common';
import { WebsocketExceptionsFilter } from 'src/websocket/websocketException.filter';

@UseFilters(WebsocketExceptionsFilter)
@WebSocketGateway()
export class PartyGateway {
  constructor(private readonly partyService: PartyService) {}
  private logger = new Logger('Websocket - party');

  @SubscribeMessage('create_party')
  create(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    if (!email) return false;
    this.logger.debug('create_party');
    return this.partyService.create({ email });
  }

  @SubscribeMessage('get_party')
  findOne(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    if (!email) return false;
    this.logger.debug('get_party');
    return this.partyService.findOne({ email });
  }

  @SubscribeMessage('remove_party')
  remove(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    if (!email) return false;
    this.logger.debug('remove_party');
    return this.partyService.remove({ email });
  }

  @SubscribeMessage('invite_to_party')
  invite(
    @MessageBody() invitedEmail: string,
    @ConnectedSocket() client: Socket,
  ) {
    const email = client.handshake.auth.email;
    if (!email) return false;
    this.logger.debug('invite_to_party');
    return this.partyService.invite({ leaderEmail: email, invitedEmail });
  }

  @SubscribeMessage('kick_from_party')
  kick(@MessageBody() kickedEmail: string, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    if (!email) return false;
    this.logger.debug('kick_from_party');
    return this.partyService.kick({ leaderEmail: email, kickedEmail });
  }

  @SubscribeMessage('quit_party')
  quit(@MessageBody() partyId: number, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    if (!email) return false;
    this.logger.debug('quit_party');
    return this.partyService.quitParty({ email: email, partyId });
  }

  @SubscribeMessage('join_party')
  join(@MessageBody() partyId: number, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    if (!email) return false;
    this.logger.debug('join_party');
    return this.partyService.joinParty({ email, partyId });
  }
}
