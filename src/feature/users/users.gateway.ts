import { WebSocketGateway, SubscribeMessage, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { Socket } from 'socket.io';

import { Logger, UseFilters } from '@nestjs/common';
import { UsersService } from './users.service';

import { CreateUserDto } from './dto/create-user.dto';
import { WebsocketExceptionsFilter } from 'src/core/websocket/websocketException.filter';

@UseFilters(WebsocketExceptionsFilter)
@WebSocketGateway({ cors: true })
export class UsersGateway {
  constructor(private readonly userService: UsersService) {}
  private logger = new Logger('Websocket - users');

  @SubscribeMessage('get_user')
  async findOne(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug(`'get_user' ${email}`);
    if (!email) return false;

    return this.userService.findOne({ userEmail: email });
  }

  @SubscribeMessage('get_all_user')
  async findAll(@MessageBody() params: { page: number }) {
    this.logger.debug('get_all_user');
    const users = await this.userService.getUsersPage(params);
    return users;
  }

  @SubscribeMessage('create_user')
  async create(@MessageBody() createUserDto: CreateUserDto, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    if (!email) return false;
    this.logger.debug('create_user');
    return this.userService.create({ ...createUserDto, email: email });
  }

  @SubscribeMessage('update_user_name')
  async updateName(@MessageBody() newName: string, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    if (!email) return false;
    this.logger.debug('update_user_name');
    return this.userService.updateUserName({ email: email, newName });
  }

  @SubscribeMessage('delete_user')
  async remove(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    if (!email) return false;
    this.logger.debug('delete_user');
    return this.userService.deleteUser(email);
  }

  @SubscribeMessage('get_all_professions')
  async getAllClasses() {
    this.logger.debug('get_all_professions');
    return this.userService.getAllProfessions();
  }
  @SubscribeMessage('get_all_heads')
  async getAllHeads() {
    this.logger.debug('get_all_heads');
    return this.userService.getAllHeads();
  }
}
