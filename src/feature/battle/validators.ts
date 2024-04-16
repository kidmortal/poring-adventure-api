import { WsException } from '@nestjs/websockets';
import { BattleInstance } from './battle';

function validateBattleInstanceStart(instance: BattleInstance) {
  if (!instance.isMonsterAlive) {
    throw new WsException('Monster is already dead since the battle beginning');
  }
  if (!instance.isPlayersAlive) {
    throw new WsException('Player is already dead since the battle beginning');
  }
}

export const BattleValidations = {
  validateBattleInstanceStart,
};
