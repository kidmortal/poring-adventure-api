import { WsException } from '@nestjs/websockets';
import { BattleInstance } from './battle';

function validateBattleInstanceStart(instance: BattleInstance) {
  // Named, because the fix is an admin resync of that particular character and
  // the party cannot guess which of them it is from "something went wrong".
  const broken = instance.brokenMembers;
  if (broken.length > 0) {
    const names = broken.map((user) => user.name).join(', ');
    throw new WsException(`${names} has a broken stat sheet — an admin has to resync it before fighting`);
  }
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
