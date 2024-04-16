import { IsEmail, IsNotEmpty, MinLength, IsIn } from 'class-validator';

const ALLOWED_GENDERS = ['male', 'female'];

export class CreateUserDto {
  // core info
  @IsEmail()
  email: string;

  @MinLength(3)
  name: string;

  @IsNotEmpty()
  professionId: number;

  @IsNotEmpty()
  costume: string;

  // appearance
  @IsIn(ALLOWED_GENDERS)
  @IsNotEmpty()
  gender: string;
}
