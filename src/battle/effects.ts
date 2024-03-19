import { BattleInstance, DamageStepParams } from './battle';

type Effect = (params: {
  dmgStep: DamageStepParams;
  image: string;
  battle: BattleInstance;
}) => {
  onAttack: () => void;
  onDefense: () => void;
};

type EffectMap = {
  [effect: string]: Effect;
};

const effects: EffectMap = {
  power_up: (params) => {
    return {
      onAttack: () => {
        params.dmgStep.damage.value *= 1.5;
      },
      onDefense: () => {
        params.dmgStep.damage.value *= 0.5;
      },
    };
  },
  invincible: (params) => {
    return {
      onAttack: () => {},
      onDefense: () => {
        params.dmgStep.skipDamageStep = true;
        params.battle.pushLog({
          icon: params.image,
          log: `${params.dmgStep.user.name} Negated ${params.dmgStep.damage.value} damage from ${params.dmgStep.monster.name}`,
        });
      },
    };
  },
};

export function runEffect({
  effect,
  role,
  ...rest
}: {
  effect: string;
  dmgStep: DamageStepParams;
  image: string;
  battle: BattleInstance;
  role: 'attacker' | 'defender';
}) {
  const effectFuntion = effects[effect];
  if (effectFuntion) {
    if (role === 'attacker') effectFuntion(rest).onAttack();
    if (role === 'defender') effectFuntion(rest).onDefense();
  }
}
