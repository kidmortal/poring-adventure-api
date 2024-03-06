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
} from '@nestjs/common';
import { MarketService } from './market.service';
import { CreateMarketDto } from './dto/create-market.dto';
import { UpdateMarketDto } from './dto/update-market.dto';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('market')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @UseGuards(AuthGuard)
  @Post()
  create(@Body() createMarketDto: CreateMarketDto, @Headers() headers) {
    const authEmail = headers['authenticated_email'];
    return this.marketService.create(createMarketDto, authEmail);
  }

  @Get()
  findAll() {
    return this.marketService.findAll();
  }

  @UseGuards(AuthGuard)
  @Get('/purchase/:id')
  purchase(@Param('id') id: string, @Headers() headers) {
    const authEmail = headers['authenticated_email'];
    return this.marketService.purchase({
      marketListingId: +id,
      buyerEmail: authEmail,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.marketService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMarketDto: UpdateMarketDto) {
    return this.marketService.update(+id, updateMarketDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.marketService.remove(+id);
  }
}
