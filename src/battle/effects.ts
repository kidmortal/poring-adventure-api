import { BattleInstance, DamageStepParams } from './battle';

const effects = {
  power_up: (params: {
    dmgStep: DamageStepParams;
    image: string;
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
        icon: params.image,
        log: `${params.dmgStep.user.name} Cannot be damaged by ${params.dmgStep.monster.name}`,
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
  image: string;
  battle: BattleInstance;
  role: 'attacker' | 'defender';
}) {
  console.log(effect);
  effects[effect](rest);
}
