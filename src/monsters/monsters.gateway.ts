import { WebSocketGateway, SubscribeMessage } from '@nestjs/websockets';

import { Logger } from '@nestjs/common';
import { MonstersService } from './monsters.service';

@WebSocketGateway({ cors: true })
export class MonsterGateway {
  constructor(private readonly monsterService: MonstersService) {}
  private logger = new Logger('Websocket');

  @SubscribeMessage('get_monster')
  async getMonster() {
    this.logger.debug('get_monster');
    return this.monsterService.findOne();
  }
}
