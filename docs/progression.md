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

Each class has a ladder of sixteen rungs from level 1 to 50, written as a table
in `characters.ts` because that is how it is tuned. The **Priest's is the one
that is deliberately not about damage**: two rungs in sixteen deal any at all
(Smite at 3 and Holy Strike at 9, early because that is where a Priest is
levelling alone), and the rest is five heals, three party blessings, a party
cleanse and three curses that cost a whole turn and land nothing but the curse.

One catch when tuning any of them: **`Skill.multiplier` is an integer column**,
so a `power` written as `2.5` reaches the table as a `2` while the generated
description still claims 250%. Several older rungs are already in that state.

### The level is derived, and derived from the row

`levelUpUser` reads `Stats.level` and `Stats.experience` **off the row**, never
off a caller's copy, and moves the level to whatever `getLevelFromExp` says the
experience is worth. It is idempotent by construction: run it twice and the
second run finds nothing to do.

That is not a stylistic preference. It used to take the battle's in-memory
player, and for a **party member** that object is a snapshot out of the *party*
cache — a different key from `user_<email>`, which reward writes clear and the
party payload's copy does not. The snapshot's experience stopped moving while
the row's kept climbing, so every fight re-derived the same level-up from the
same stale basis and incremented again. When the party cache finally refreshed,
the row's inflated level was suddenly far above what its experience justified
and the correction arrived as one enormous decrement — enough, after a few
fights, to leave a character at a negative level with the maximum health to
match. `battle.service` now clears the party cache after paying rewards as well.

`resync_levels` (admin) is the repair: it runs the same correction over one
character or all of them. It restores the level difference and the class stat
blocks that went with it, and deliberately does **not** recompute the stats
outright — equipment and guild blessings are written into the same row, and a
recompute would delete them.

A battle refuses to start at all if a member's sheet is impossible — level below
1, or maximum health at or under zero. That is corruption rather than injury,
and it says whose sheet it is.

## Stamina

`Stats.stamina` / `maxStamina` / `staminaRefilledAt` —
`UserStaminaService.refillIfNewDay` tops it back up the first time the player is
seen on a new UTC day, triggered by reading the profile (`get_user`).

Stamina is **the only genuinely scarce resource in the game**: it is what caps
the supply of everything the trades produce. Base is 50
(`BASE_MAX_STAMINA`), and a profession adds one point per two of its levels
(`LEVELS_PER_STAMINA`) via `maxStaminaForProfession`.

A guild can buy more of it. The `stamina` blessing adds a point per level to
every member's ceiling, banked in `Stats.bonusMaxStamina` and fed back into
`maxStaminaForProfession({ level, bonus })` so a profession level-up recomputes
the ceiling without spending it — see [guilds.md](guilds.md#blessings). It is
the only blessing a player who never fights has a reason to care about.

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
