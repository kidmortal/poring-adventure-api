import { Module } from '@nestjs/common';

import { WebsocketGateway } from './websocket.gateway';
import { AuthModule } from 'src/auth/auth.module';
import { WebsocketService } from './websocket.service';
import { WebsocketController } from './websocket.controller';

@Module({
  controllers: [WebsocketController],
  imports: [AuthModule],
  providers: [WebsocketGateway, WebsocketService],
  exports: [WebsocketService],
})
export class WebsocketModule {}
