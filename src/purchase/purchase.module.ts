import { Module } from '@nestjs/common';
import { PurchaseService } from './purchase.service';
import { PurchaseController } from './purchase.controller';
import { PurchaseGateway } from './purchase.gateway';
import { NotificationModule } from 'src/notification/notification.module';
import { WebsocketModule } from 'src/websocket/websocket.module';

@Module({
  imports: [NotificationModule, WebsocketModule],
  controllers: [PurchaseController],
  providers: [PurchaseService, PurchaseGateway],
})
export class PurchaseModule {}
