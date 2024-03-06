import { PartialType } from '@nestjs/mapped-types';
import { CreateMarketDto } from './create-market.dto';

export class UpdateMarketDto extends PartialType(CreateMarketDto) {}
