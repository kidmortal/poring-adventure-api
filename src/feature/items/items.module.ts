import { Module } from '@nestjs/common';
import { ItemsService } from './items.service';
import { UsersModule } from 'src/feature/users/users.module';
import { ItemsGateway } from './items.gateway';
import { WebsocketModule } from 'src/core/websocket/websocket.module';

@Module({
  imports: [UsersModule, WebsocketModule],
  providers: [ItemsService, ItemsGateway],
  exports: [ItemsService],
})
export class ItemsModule {}
