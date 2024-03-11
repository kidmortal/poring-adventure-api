import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UserGateway } from './user.gateway';
import { WebsocketModule } from 'src/websocket/websocket.module';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UserGateway],
  exports: [UsersService],
  imports: [WebsocketModule],
})
export class UsersModule {}
