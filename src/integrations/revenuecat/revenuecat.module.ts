import { Module } from '@nestjs/common';
import { RevenueCatService } from './revenuecat.service';

@Module({
  providers: [RevenueCatService],
  exports: [RevenueCatService],
})
export class RevenueCatModule {}
