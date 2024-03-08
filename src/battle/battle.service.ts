import { Injectable } from '@nestjs/common';
import { CreateBattleDto } from './dto/create-battle.dto';
import { UpdateBattleDto } from './dto/update-battle.dto';

@Injectable()
export class BattleService {
  create(createBattleDto: CreateBattleDto) {
    return 'This action adds a new battle';
  }

  findAll() {
    return `This action returns all battle`;
  }

  findOne(id: number) {
    return `This action returns a #${id} battle`;
  }

  update(id: number, updateBattleDto: UpdateBattleDto) {
    return `This action updates a #${id} battle`;
  }

  remove(id: number) {
    return `This action removes a #${id} battle`;
  }
}
