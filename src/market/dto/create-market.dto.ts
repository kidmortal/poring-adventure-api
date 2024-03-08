import { IsNumber } from 'class-validator';

export class CreateMarketDto {
  @IsNumber()
  price: number;
  @IsNumber()
  stack: number;
  @IsNumber()
  itemId: number;
}
