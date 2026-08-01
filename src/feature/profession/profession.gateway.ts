import { WebSocketGateway, SubscribeMessage, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { Logger, UseFilters, UseGuards } from '@nestjs/common';

import { WebsocketExceptionsFilter } from 'src/core/websocket/websocketException.filter';
import { WebsocketAuthEmailGuard } from 'src/core/websocket/websocket.guard';
import { UsersService } from 'src/feature/users/users.service';
import { ProfessionService } from './profession.service';
import { GatheringService } from './gathering.service';
import { CraftingService } from './crafting.service';
import { GatheringNodeIdDto, ProfessionIdDto, RecipeIdDto } from './dto/profession.dto';

@UseGuards(WebsocketAuthEmailGuard)
@UseFilters(WebsocketExceptionsFilter)
@WebSocketGateway({ cors: true })
export class ProfessionGateway {
  constructor(
    private readonly professionService: ProfessionService,
    private readonly gatheringService: GatheringService,
    private readonly craftingService: CraftingService,
    private readonly userService: UsersService,
  ) {}
  private logger = new Logger('Websocket - professions');

  @SubscribeMessage('get_all_professions')
  async getAllProfessions() {
    this.logger.debug('get_all_professions');
    return this.professionService.getAllProfessions();
  }

  @SubscribeMessage('get_user_professions')
  async getUserProfessions(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug(`get_user_professions ${email}`);
    return this.professionService.getUserProfessions({ userEmail: email });
  }

  @SubscribeMessage('learn_profession')
  async learnProfession(@MessageBody() dto: ProfessionIdDto, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug(`learn_profession ${email}`);
    await this.professionService.learnProfession({ userEmail: email, professionId: dto.professionId });
    // The learned trade rides along on the profile, so the client only needs
    // the push to render it.
    return this.userService.notifyUserUpdateWithProfile({ email });
  }

  @SubscribeMessage('get_gathering_nodes')
  async getGatheringNodes() {
    this.logger.debug('get_gathering_nodes');
    return this.gatheringService.getAllNodes();
  }

  @SubscribeMessage('gather')
  async gather(@MessageBody() dto: GatheringNodeIdDto, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug(`gather ${email}`);
    return this.gatheringService.gather({ userEmail: email, nodeId: dto.nodeId });
  }

  @SubscribeMessage('get_recipes')
  async getRecipes() {
    this.logger.debug('get_recipes');
    return this.craftingService.getAllRecipes();
  }

  @SubscribeMessage('craft')
  async craft(@MessageBody() dto: RecipeIdDto, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug(`craft ${email}`);
    return this.craftingService.craft({ userEmail: email, recipeId: dto.recipeId });
  }
}
