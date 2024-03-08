import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UserGateway } from './user.gateway';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UserGateway],
  exports: [UsersService],
  imports: [],
})
export class UsersModule {}
