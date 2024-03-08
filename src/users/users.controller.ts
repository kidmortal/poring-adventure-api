import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Headers,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { Throttle } from '@nestjs/throttler';

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

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get('/revalidate')
  revalidateUsers() {
    return this.usersService.revalidateUsers();
  }

  @Throttle({ default: { limit: 30, ttl: 30000 } })
  @Get(':email')
  findOne(@Param('email') email: string) {
    return this.usersService.findOne(email);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.updateUser(+id, updateUserDto);
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
}
