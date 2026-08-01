import { IsNotEmpty, IsOptional } from 'class-validator';

/** A gift: silver, one item stack, or both, with an optional note. */
export class SendGiftDto {
  @IsNotEmpty()
  receiverEmail: string;

  @IsOptional()
  silver?: number;

  @IsOptional()
  inventoryId?: number;

  @IsOptional()
  stack?: number;

  @IsOptional()
  message?: string;
}
