import { Module } from '@nestjs/common';
import { UsersModule } from 'src/feature/users/users.module';
import { ItemsModule } from 'src/feature/items/items.module';
import { WebsocketModule } from 'src/core/websocket/websocket.module';
import { MailModule } from 'src/feature/mail/mail.module';

import { ProfessionService } from './profession.service';
import { GatheringService } from './gathering.service';
import { CraftingService } from './crafting.service';
import { ServiceOfferService } from './serviceOffer.service';
import { HiringService } from './hiring.service';
import { CommissionService } from './commission.service';
import { ProfessionGateway } from './profession.gateway';

const providers = [
  ProfessionService,
  GatheringService,
  CraftingService,
  ServiceOfferService,
  HiringService,
  CommissionService,
];

@Module({
  imports: [UsersModule, ItemsModule, WebsocketModule, MailModule],
  providers: [...providers, ProfessionGateway],
  exports: providers,
})
export class ProfessionModule {}
