import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { GuildService } from './guild.service';
import { CreateGuildDto } from './dto/create-guild.dto';
import { Logger, UseFilters } from '@nestjs/common';
import { WebsocketExceptionsFilter } from 'src/websocket/websocketException.filter';

@WebSocketGateway()
@UseFilters(WebsocketExceptionsFilter)
export class GuildGateway {
  constructor(private readonly guildService: GuildService) {}
  private logger = new Logger('Websocket - guilds');

  @SubscribeMessage('create_guild')
  create(@MessageBody() createGuildDto: CreateGuildDto) {
    return this.guildService.create(createGuildDto);
  }

  @SubscribeMessage('find_guild')
  findOne(@MessageBody() id: number) {
    return this.guildService.findOne(id);
  }

  @SubscribeMessage('find_all_guild')
  findAll() {
    this.logger.debug('find_all_guild');
    return this.guildService.findAll();
  }
}
