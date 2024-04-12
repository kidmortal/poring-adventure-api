import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGateway } from './admin.gateway';
import { UsersModule } from 'src/users/users.module';
import { WebsocketModule } from 'src/websocket/websocket.module';
import { CacheModule } from '@nestjs/cache-manager';
import { NotificationModule } from 'src/notification/notification.module';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [
    UsersModule,
    WebsocketModule,
    NotificationModule,
    MailModule,
    CacheModule.register({ ttl: 1000 * 60 * 10 }),
  ],
  providers: [AdminGateway, AdminService],
})
export class AdminModule {}
