import { IsEmail, IsNotEmpty, IsNumber } from 'class-validator';

export class AddItemDto {
  @IsNotEmpty()
  stack: number;

  @IsEmail()
  @IsNotEmpty()
  userEmail: string;

  @IsNumber()
  itemId: number;
}
