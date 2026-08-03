import { WebSocketGateway, SubscribeMessage, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { Logger, UseFilters, UseGuards } from '@nestjs/common';

import { WebsocketExceptionsFilter } from 'src/core/websocket/websocketException.filter';
import { WebsocketAuthEmailGuard } from 'src/core/websocket/websocket.guard';
import { UsersService } from 'src/feature/users/users.service';
import { ProfessionService } from './profession.service';
import { GatheringService } from './gathering.service';
import { CraftingService } from './crafting.service';
import { ServiceOfferService } from './serviceOffer.service';
import { HiringService } from './hiring.service';
import { CommissionService } from './commission.service';
import {
  CommissionIdDto,
  GatheringNodeIdDto,
  HireCraftDto,
  HireEnhanceDto,
  InventoryIdDto,
  ProfessionIdDto,
  PublishServiceOfferDto,
  RecipeIdDto,
} from './dto/profession.dto';

@UseGuards(WebsocketAuthEmailGuard)
@UseFilters(WebsocketExceptionsFilter)
@WebSocketGateway({ cors: true })
export class ProfessionGateway {
  constructor(
    private readonly professionService: ProfessionService,
    private readonly gatheringService: GatheringService,
    private readonly craftingService: CraftingService,
    private readonly offerService: ServiceOfferService,
    private readonly hiringService: HiringService,
    private readonly commissionService: CommissionService,
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

  @SubscribeMessage('get_commissions')
  async getCommissions(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug(`get_commissions ${email}`);
    return this.commissionService.getBoard({ userEmail: email });
  }

  @SubscribeMessage('deliver_commission')
  async deliverCommission(@MessageBody() dto: CommissionIdDto, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug(`deliver_commission ${email}`);
    return this.commissionService.deliver({ userEmail: email, commissionId: dto.commissionId });
  }

  @SubscribeMessage('get_service_offers')
  async getServiceOffers() {
    this.logger.debug('get_service_offers');
    return this.offerService.getAllOffers();
  }

  @SubscribeMessage('get_user_service_offer')
  async getUserServiceOffer(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug(`get_user_service_offer ${email}`);
    return this.offerService.getUserOffer({ crafterEmail: email });
  }

  @SubscribeMessage('publish_service_offer')
  async publishServiceOffer(@MessageBody() dto: PublishServiceOfferDto, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug(`publish_service_offer ${email}`);
    return this.offerService.publishOffer({
      crafterEmail: email,
      pricePerStamina: dto.pricePerStamina,
      crafting: dto.crafting,
      enhancing: dto.enhancing,
    });
  }

  @SubscribeMessage('remove_service_offer')
  async removeServiceOffer(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug(`remove_service_offer ${email}`);
    return this.offerService.removeOffer({ crafterEmail: email });
  }

  @SubscribeMessage('hire_craft')
  async hireCraft(@MessageBody() dto: HireCraftDto, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug(`hire_craft ${email}`);
    return this.hiringService.hireCraft({ hirerEmail: email, offerId: dto.offerId, recipeId: dto.recipeId });
  }

  @SubscribeMessage('self_assisted_enhance')
  async selfAssistedEnhance(@MessageBody() dto: InventoryIdDto, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug(`self_assisted_enhance ${email}`);
    return this.hiringService.selfAssistedEnhance({ userEmail: email, inventoryId: dto.inventoryId });
  }

  @SubscribeMessage('hire_enhance')
  async hireEnhance(@MessageBody() dto: HireEnhanceDto, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug(`hire_enhance ${email}`);
    return this.hiringService.hireEnhance({
      hirerEmail: email,
      offerId: dto.offerId,
      inventoryId: dto.inventoryId,
    });
  }
}
