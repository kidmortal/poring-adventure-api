import {
  Controller,
  Get,
  Param,
  Delete,
  UseGuards,
  Headers,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';

import { AuthGuard } from 'src/auth/auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
