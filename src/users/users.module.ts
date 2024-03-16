import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersGateway } from './users.gateway';
import { WebsocketModule } from 'src/websocket/websocket.module';

@Module({
  controllers: [],
  providers: [UsersService, UsersGateway],
  exports: [UsersService],
  imports: [WebsocketModule],
})
export class UsersModule {}
