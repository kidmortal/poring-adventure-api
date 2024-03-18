import { BattleInstance, DamageStepParams } from './entities/battle';

const effects = {
  power_up: (params: {
    dmgStep: DamageStepParams;
    battle: BattleInstance;
    role: 'attacker' | 'defender';
  }) => {
    if (params.role === 'attacker') {
      console.log('increasing damage');
      params.dmgStep.damage.value *= 1.5;
    }
    if (params.role === 'defender') {
      params.dmgStep.skipDamageStep = true;
      params.battle.pushLog({
        icon: 'https://cdn.discordapp.com/emojis/1167895403761520652.webp?size=96&quality=lossless',
        log: `${params.dmgStep.user.name} Used hack and stopped ${params.dmgStep.monster.name}'s Attack`,
      });
      // console.log('reducing damage');
      // params.dmgStep.damage.value *= 0.5;
    }
  },
};

export function runEffect({
  effect,
  ...rest
}: {
  effect: string;
  dmgStep: DamageStepParams;
  battle: BattleInstance;
  role: 'attacker' | 'defender';
}) {
  console.log(effect);
  effects[effect](rest);
}
