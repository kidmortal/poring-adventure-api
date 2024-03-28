import { Module } from '@nestjs/common';

import { WebsocketModule } from 'src/websocket/websocket.module';
import { UsersModule } from 'src/users/users.module';
import { MailGateway } from './mail.gateway';
import { MailService } from './mail.service';

@Module({
  imports: [WebsocketModule, UsersModule],
  providers: [MailGateway, MailService],
})
export class MailModule {}
