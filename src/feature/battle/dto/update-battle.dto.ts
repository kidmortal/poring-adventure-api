import { PartialType } from '@nestjs/mapped-types';
import { CreateBattleDto } from './create-battle.dto';

export class UpdateBattleDto extends PartialType(CreateBattleDto) {
  id: number;
}
