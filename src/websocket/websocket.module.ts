import { Module } from '@nestjs/common';

import { WebsocketGateway } from './websocket.gateway';
import { AuthModule } from 'src/auth/auth.module';
import { WebsocketService } from './websocket.service';
import { WebsocketController } from './websocket.controller';
import { UsersModule } from 'src/users/users.module';

@Module({
  controllers: [WebsocketController],
  imports: [AuthModule, UsersModule],
  providers: [WebsocketGateway, WebsocketService],
  exports: [WebsocketService],
})
export class WebsocketModule {}
