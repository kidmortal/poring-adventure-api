import { Module } from '@nestjs/common';

import { WebsocketGateway } from './websocket.gateway';
import { AuthModule } from 'src/core/auth/auth.module';
import { WebsocketService } from './websocket.service';

@Module({
  controllers: [],
  imports: [AuthModule],
  providers: [WebsocketGateway, WebsocketService],
  exports: [WebsocketService],
})
export class WebsocketModule {}
