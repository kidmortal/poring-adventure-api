import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';

import { Logger } from '@nestjs/common';
import { MonstersService } from './monsters.service';

@WebSocketGateway({ cors: true })
export class MonsterGateway {
  constructor(private readonly monsterService: MonstersService) {}
  private logger = new Logger('Websocket - monsters');

  @SubscribeMessage('get_monster_from_map')
  async getMonsterFromMap(@MessageBody() mapId: number) {
    this.logger.debug('get_monster_from_map');
    return this.monsterService.findOneFromMap(mapId);
  }

  @SubscribeMessage('get_maps')
  async getMaps() {
    this.logger.debug('get_maps');
    return this.monsterService.getAllMaps();
  }
}
