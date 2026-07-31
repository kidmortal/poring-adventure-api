import { Module } from '@nestjs/common';
import { PurchaseService } from './purchase.service';
import { PurchaseController } from './purchase.controller';
import { PurchaseGateway } from './purchase.gateway';
import { NotificationModule } from 'src/services/notification/notification.module';
import { WebsocketModule } from 'src/core/websocket/websocket.module';
import { MailModule } from 'src/feature/mail/mail.module';
import { RevenueCatService } from './revenuecat.service';

@Module({
  imports: [NotificationModule, WebsocketModule, MailModule],
  controllers: [PurchaseController],
  providers: [PurchaseService, PurchaseGateway, RevenueCatService],
})
export class PurchaseModule {}
