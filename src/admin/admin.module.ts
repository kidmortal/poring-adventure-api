import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGateway } from './admin.gateway';
import { UsersModule } from 'src/users/users.module';
import { WebsocketModule } from 'src/websocket/websocket.module';

@Module({
  imports: [UsersModule, WebsocketModule],
  providers: [AdminGateway, AdminService],
})
export class AdminModule {}
