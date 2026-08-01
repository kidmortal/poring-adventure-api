import { Module } from '@nestjs/common';
import { PurchaseService } from './purchase.service';
import { PurchaseController } from './purchase.controller';
import { PurchaseGateway } from './purchase.gateway';
import { NotificationModule } from 'src/integrations/notification/notification.module';
import { WebsocketModule } from 'src/core/websocket/websocket.module';
import { MailModule } from 'src/feature/mail/mail.module';
import { RevenueCatModule } from 'src/integrations/revenuecat/revenuecat.module';

@Module({
  imports: [NotificationModule, WebsocketModule, MailModule, RevenueCatModule],
  controllers: [PurchaseController],
  providers: [PurchaseService, PurchaseGateway],
})
export class PurchaseModule {}
