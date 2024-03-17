import {
  WebSocketGateway,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
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

  @SubscribeMessage('invite_to_party')
  invite(
    @MessageBody() invitedEmail: string,
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.debug('invite_to_party');
    const email = client.handshake.auth.email;
    return this.partyService.invite({ leaderEmail: email, invitedEmail });
  }

  @SubscribeMessage('kick_from_party')
  kick(@MessageBody() kickedEmail: string, @ConnectedSocket() client: Socket) {
    this.logger.debug('kick_from_party');
    const email = client.handshake.auth.email;
    return this.partyService.kick({ leaderEmail: email, kickedEmail });
  }

  @SubscribeMessage('quit_party')
  quit(@MessageBody() kickedEmail: string, @ConnectedSocket() client: Socket) {
    this.logger.debug('quit_party');
    const email = client.handshake.auth.email;
    return this.partyService.kick({ leaderEmail: email, kickedEmail });
  }

  @SubscribeMessage('join_party')
  join(@MessageBody() partyId: number, @ConnectedSocket() client: Socket) {
    this.logger.debug('join_party');
    const email = client.handshake.auth.email;
    return this.partyService.joinParty({ email, partyId });
  }
}
