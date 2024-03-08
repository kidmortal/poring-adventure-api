import { IsNumber } from 'class-validator';

export class PurchaseMarketDto {
  @IsNumber()
  stack: number;
  @IsNumber()
  marketListingId: number;
}
