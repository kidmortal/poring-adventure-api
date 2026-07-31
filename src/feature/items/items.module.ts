import { Module } from '@nestjs/common';
import { ItemsService } from './items.service';
import { UsersModule } from 'src/feature/users/users.module';
import { ItemsGateway } from './items.gateway';
import { WebsocketModule } from 'src/core/websocket/websocket.module';
import { InventoryService } from './inventory.service';
import { EquipmentService } from './equipment.service';

const providers = [ItemsService, InventoryService, EquipmentService];

@Module({
  imports: [UsersModule, WebsocketModule],
  providers: [...providers, ItemsGateway],
  exports: providers,
})
export class ItemsModule {}
