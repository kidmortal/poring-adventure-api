import { Buff } from '@prisma/client';
import { BattleInstance, DamageStepParams } from './battle';

type Effect = (params: {
  dmgStep: DamageStepParams;
  image: string;
  battle: BattleInstance;
  /** The buff this effect came from — meals read their percentages off it. */
  buff: Buff;
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
        params.dmgStep.damage.value *= 1.2;
        params.dmgStep.damage.aggro *= 3;
      },
      onDefense: () => (params.dmgStep.damage.value *= 0.8),
    };
  },
  parry: (params) => {
    return {
      onAttack: () => {},
      onDefense: () => {
        params.battle.pushLog({
          icon: params.image,
          log: `${params.dmgStep.user.name} Reflected ${params.dmgStep.damage.value} back to ${params.dmgStep.monster.name}`,
        });
        params.dmgStep.skipDamageStep = true;
      },
    };
  },
  /**
   * A meal. Unlike the skill buffs above it carries no fixed numbers of its own:
   * the percentages come off the buff row, so a cook's new recipe is a seed
   * entry rather than another branch in here.
   *
   * The health share is a damage reduction rather than a larger health pool,
   * because a buff that raised maxHealth mid-fight would have to be unwound
   * when it expired, and food is eaten before the fight anyway.
   */
  well_fed: (params) => {
    return {
      onAttack: () => {
        if (params.buff.attackBonus) {
          params.dmgStep.damage.value *= 1 + params.buff.attackBonus / 100;
        }
      },
      onDefense: () => {
        if (params.buff.healthBonus) {
          params.dmgStep.damage.value *= 1 - Math.min(params.buff.healthBonus, 50) / 100;
        }
      },
    };
  },
  /**
   * A Priest's blessing on the whole party. Mechanically the same trade as a
   * meal — a share of damage dealt and a share of damage taken, both read off
   * the buff row — because the numbers a cook tunes and the numbers a Priest
   * casts are the same kind of number, and neither should need new code.
   *
   * What separates them is where they come from: food is bought and eaten
   * before the fight, this costs a Priest their turn inside it.
   */
  blessed: (params) => {
    return {
      onAttack: () => {
        if (params.buff.attackBonus) {
          params.dmgStep.damage.value *= 1 + params.buff.attackBonus / 100;
        }
      },
      onDefense: () => {
        if (params.buff.healthBonus) {
          params.dmgStep.damage.value *= 1 - Math.min(params.buff.healthBonus, 50) / 100;
        }
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
  buff: Buff;
  role: 'attacker' | 'defender';
}) {
  const effectFuntion = effects[effect];
  if (effectFuntion) {
    if (role === 'attacker') effectFuntion(rest).onAttack();
    if (role === 'defender') effectFuntion(rest).onDefense();
  }
}
