import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UserGateway } from './users.gateway';
import { WebsocketModule } from 'src/websocket/websocket.module';

@Module({
  controllers: [],
  providers: [UsersService, UserGateway],
  exports: [UsersService],
  imports: [WebsocketModule],
})
export class UsersModule {}
