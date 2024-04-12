import { Module } from '@nestjs/common';

import { WebsocketModule } from 'src/websocket/websocket.module';
import { UsersModule } from 'src/users/users.module';
import { MailGateway } from './mail.gateway';
import { MailService } from './mail.service';
import { ItemsModule } from 'src/items/items.module';

@Module({
  exports: [MailService],
  imports: [WebsocketModule, UsersModule, ItemsModule],
  providers: [MailGateway, MailService],
})
export class MailModule {}
