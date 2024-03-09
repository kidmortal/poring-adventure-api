import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Headers,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

import { AuthGuard } from 'src/auth/auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(AuthGuard)
  @Post()
  create(@Body() createUserDto: CreateUserDto, @Headers() headers) {
    const authEmail = headers['authenticated_email'];
    const newUserEmail = createUserDto.email;
    if (authEmail != newUserEmail) {
      throw new ForbiddenException(
        `Your access token is for ${authEmail}, but you creating an user for ${newUserEmail}`,
      );
    }

    return this.usersService.create(createUserDto);
  }

  @UseGuards(AuthGuard)
  @Delete(':email')
  remove(@Param('email') email: string, @Headers() headers) {
    const authEmail = headers['authenticated_email'];
    if (authEmail != email) {
      throw new ForbiddenException(
        `Your access token is for ${authEmail}, but you are trying to delete a character from ${email}`,
      );
    }
    return this.usersService.deleteUser(email);
  }

  @Get('/revalidate')
  revalidateUsers() {
    return this.usersService.revalidateUsers();
  }
}
