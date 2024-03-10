import { Module } from '@nestjs/common';
import { ItemsService } from './items.service';
import { UsersModule } from 'src/users/users.module';
import { ItemsGateway } from './items.gateway';

@Module({
  imports: [UsersModule],
  providers: [ItemsService, ItemsGateway],
  exports: [ItemsService],
})
export class ItemsModule {}
