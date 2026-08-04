# Progression

Classes, levels, stats, skills and stamina. Seeded in
`core/prisma/seed/characters.ts`; enforced in `feature/users`.

## Levels

`Utils.getLevelFromExp` — level *n* costs `n × 100` experience, so the curve is
cumulative and gentle. A monster pays roughly `6 × level`, which keeps a level
worth about seventeen fights at any point in the game.

`UserStatsService.levelUpUser` recomputes the correct level from total
experience and moves the character **in either direction** — an admin removing
experience de-levels correctly.

## Stats come entirely from the class

`_applyLevels` applies exactly one copy of the class's per-level block per
level. There is no allocation, no talent tree: **a character's stats are their
class times their level, plus gear.**

| Class | atk | hp | mp | str | agi | int | def | Role |
|---|---|---|---|---|---|---|---|---|
| Rune Knight ⚔️ | 3 | 5 | 2 | 2 | 2 | 1 | 2 | Melee hybrid |
| Priest ✨ | 1 | 3 | 6 | 1 | 1 | 3 | 1 | Support — deepest mana, shallowest scaling |
| Mage 🔮 | 1 | 2 | 4 | 1 | 1 | 4 | 0 | Glass cannon |
| Knight 🛡️ | 2 | 7 | 1 | 3 | 1 | 1 | 3 | Tank |
| Assassin 🗡️ | 5 | 2 | 2 | 1 | 4 | 1 | 0 | Fast striker |

How the stats are actually read in a fight:

- **attack** — the base of every hit.
- **str** — adds `str / 2` to effective defense. Otherwise inert, which is why
  it is the Knight's largest stat.
- **agi** — turn order, and evasion at `agi / 200` capped at 20%.
- **int** — the attribute most caster skills scale off.
- **defense** — the mitigation curve, see [combat.md](combat.md).

`defense` is newer than the characters holding it, so the seed has a
`backfillDefense` step that recomputes it from class × level for existing
players.

## Skills

`Skill` rows belong to a class. A player `learn_skill`s one (gated on
`requiredLevel`), then `equip_skill`s it to bring it to a fight.
`LearnedSkill.masteryLevel` multiplies the skill's power.

Skill behaviour is in [combat.md](combat.md).

## Stamina

`Stats.stamina` / `maxStamina` / `staminaRefilledAt` —
`UserStaminaService.refillIfNewDay` tops it back up the first time the player is
seen on a new UTC day, triggered by reading the profile (`get_user`).

Stamina is **the only genuinely scarce resource in the game**: it is what caps
the supply of everything the trades produce. Base is 50
(`BASE_MAX_STAMINA`), and a profession adds one point per two of its levels
(`LEVELS_PER_STAMINA`) via `maxStaminaForProfession`.

Combat costs no stamina. Gathering, crafting and hired jobs cost all of it.

## Buffs on a player

`UserBuff.duration` counts **battles, not time** — `decreaseUserBuffs` ticks
every buff down by one as part of the battle reward transaction, and drops any
that reach zero.

`applyBuff` extends an existing buff rather than stacking rows, and caps the
total at `Buff.duration × Buff.maxStack`. That ceiling is deliberate: without it
a cook could hand someone a hundred battles of +10% attack in one sitting, and
the demand for food would never regenerate.

`Buff.persist` marks a buff that survives outside combat. `Buff.effect` is a
named string the battle engine branches on — see `effects.ts`.
