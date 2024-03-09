import { Injectable } from '@nestjs/common';

import { UpdateBattleDto } from './dto/update-battle.dto';
import { Battle } from './entities/battle';
import { MonstersService } from 'src/monsters/monsters.service';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class BattleService {
  constructor(
    private readonly monsterService: MonstersService,
    private readonly userService: UsersService,
  ) {}
  private battleList: Battle[] = [];

  async create(userEmail: string) {
    const battle = this.getUserBattle(userEmail);
    if (!battle) {
      const userData = await this.userService.findOne(userEmail);
      const monsterData = await this.monsterService.findOne();
      const newBattleInstance: Battle = {
        user: userData,
        monster: monsterData,
        log: [],
      };
      this.battleList.push(newBattleInstance);
      return newBattleInstance;
    }
    return battle;
  }

  async remove(userEmail: string) {
    const battleIndex = this.battleList.findIndex(
      (battle) => battle.user.email === userEmail,
    );

    if (battleIndex >= 0) {
      this.battleList.splice(battleIndex, 1);
      return true;
    }
    return false;
  }

  async attack(userEmail: string) {
    const battle = this.getUserBattle(userEmail);
    if (!battle) {
      return false;
    }
    // @ts-expect-error i hate ts
    battle.user.stats.health -= 1;
    battle.monster.health -= 1;
    battle.log.push(
      `${battle.user.name} Dealt 1 damage to ${battle.monster.name}`,
    );
    battle.log.push(
      `${battle.monster.name} Dealt 1 damage to ${battle.user.name}`,
    );

    return battle;
  }

  private getUserBattle(userEmail: string) {
    const onGoingBattle = this.battleList.find(
      (battle) => battle.user.email === userEmail,
    );
    if (onGoingBattle) {
      return onGoingBattle;
    }
    return false;
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
}
