import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { MarketService } from './market.service';
import { CreateMarketDto } from './dto/create-market.dto';
// import { UpdateMarketDto } from './dto/update-market.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { PurchaseMarketDto } from './dto/purchase-market.dto';

@Controller('market')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @UseGuards(AuthGuard)
  @Post()
  create(@Body() createMarketDto: CreateMarketDto, @Headers() headers) {
    const authEmail = headers['authenticated_email'];
    return this.marketService.addItemToMarket(createMarketDto, authEmail);
  }

  @Get()
  findAll() {
    return this.marketService.findAll();
  }

  @UseGuards(AuthGuard)
  @Post('/purchase')
  purchase(@Body() purchaseDto: PurchaseMarketDto, @Headers() headers) {
    const authEmail = headers['authenticated_email'];
    return this.marketService.purchase({
      marketListingId: purchaseDto.marketListingId,
      stacks: purchaseDto.stack,
      buyerEmail: authEmail,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.marketService.findOne(+id);
  }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateMarketDto: UpdateMarketDto) {
  //   return this.marketService.update(+id, updateMarketDto);
  // }

  @UseGuards(AuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @Headers() headers) {
    const authEmail = headers['authenticated_email'];
    return this.marketService.remove(+id, authEmail);
  }
}
