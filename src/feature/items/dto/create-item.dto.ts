import { IsEmail, IsNotEmpty } from 'class-validator';

export class CreateItemDto {
  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  category: string;

  @IsNotEmpty()
  stack: number;

  @IsEmail()
  @IsNotEmpty()
  userEmail: string;

  @IsNotEmpty()
  image: string;
}
