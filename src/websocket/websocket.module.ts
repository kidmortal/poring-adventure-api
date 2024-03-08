import { Module } from '@nestjs/common';

import { WebsocketGateway } from './websocket.gateway';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [WebsocketGateway],
})
export class WebsocketModule {}
