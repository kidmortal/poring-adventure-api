import { WebSocketGateway, SubscribeMessage, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { PartyService } from './party.service';
import { Logger, UseFilters, UseGuards } from '@nestjs/common';
import { WebsocketExceptionsFilter } from 'src/core/websocket/websocketException.filter';
import { WebsocketAuthEmailGuard } from 'src/core/websocket/websocket.guard';

@UseFilters(WebsocketExceptionsFilter)
@UseGuards(WebsocketAuthEmailGuard)
@WebSocketGateway()
export class PartyGateway {
  constructor(private readonly partyService: PartyService) {}
  private logger = new Logger('Websocket - party');

  @SubscribeMessage('create_party')
  create(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('create_party');
    return this.partyService.create({ email });
  }
  @SubscribeMessage('remove_party')
  remove(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('remove_party');
    return this.partyService.remove({ email });
  }

  @SubscribeMessage('get_party')
  findOne(@MessageBody() dto: GetPartyDto, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('get_party');
    return this.partyService.findOne({ partyId: dto.partyId, email });
  }

  @SubscribeMessage('invite_to_party')
  invite(@MessageBody() dto: InviteToPartyDto, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('invite_to_party');
    return this.partyService.invite({ userEmail: email, invitedEmail: dto.invitedEmail, partyId: dto.partyId });
  }

  @SubscribeMessage('kick_from_party')
  kick(@MessageBody() dto: KickFromPartyDto, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('kick_from_party');
    return this.partyService.kick({ partyId: dto.partyId, userEmail: email, kickedEmail: dto.kickedEmail });
  }

  @SubscribeMessage('quit_party')
  quit(@MessageBody() dto: QuitPartyDto, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('quit_party');
    return this.partyService.quitParty({ email: email, partyId: dto.partyId });
  }

  @SubscribeMessage('join_party')
  join(@MessageBody() dto: JoinPartyDto, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('join_party');
    return this.partyService.joinParty({ email, partyId: dto.partyId });
  }
}
