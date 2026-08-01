import { Module } from '@nestjs/common';
import { UsersModule } from 'src/feature/users/users.module';
import { ItemsModule } from 'src/feature/items/items.module';
import { WebsocketModule } from 'src/core/websocket/websocket.module';

import { ProfessionService } from './profession.service';
import { GatheringService } from './gathering.service';
import { CraftingService } from './crafting.service';
import { ProfessionGateway } from './profession.gateway';

const providers = [ProfessionService, GatheringService, CraftingService];

@Module({
  imports: [UsersModule, ItemsModule, WebsocketModule],
  providers: [...providers, ProfessionGateway],
  exports: providers,
})
export class ProfessionModule {}
