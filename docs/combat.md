# Combat

Everything in `src/feature/battle`. Turn-based, co-op, and **entirely in
memory** — `BattleService.battleList` holds live `BattleInstance` objects, and a
restart drops every fight in progress.

Design rationale lives in `combat_plan.md` at the repo root. This is what exists.

## The two halves

| File | Owns |
|---|---|
| `battle.service.ts` | The battle *list*: creating fights, ending them, and everything that touches the database — rewards, guild boss damage, dungeon runs. |
| `battle.ts` (`BattleInstance`) | What happens *at the table*. Never touches the database; it is handed users and monsters and mutates them in place. |
| `battleUtils.ts` | Turn order, mitigation, evasion, enrage maths. Pure. |
| `effects.ts` | Buff effects that hook the damage pipeline (`power_up`, `parry`, `invincible`…). |
| `debuffs.ts` | Debuffs on monsters — apply, tick, and the four effects. |
| `barrier.ts` | Absorbing damage against barrier buffs. |
| `validators.ts` | Refuses a battle that starts already decided. |

## Lifecycle

1. **Create.** One of four entry points on `BattleService`:
   - `create({ userEmail, mapId })` — a random pull from a map.
   - `createGuildBossBattle({ userEmail })` — see [guilds.md](guilds.md).
   - `createDungeonBattle({ userEmail, dungeonId })` — see [dungeons.md](dungeons.md).
   - `continueDungeonRun({ userEmail })` — the next boss of a run.

   All of them pull **the whole party** in automatically (`_gatherParty`).
2. **Tick.** `@Cron('*/3 * * * * *')` calls `tickBattle()` on every live battle,
   which is how monsters take their turns. A finished battle is skipped.
3. **Act.** `attack` / `cast` / `useItem` go through the instance, which checks
   it is that player's turn.
4. **Settle.** `settleBattleAndProcessRewards` runs after every damage step:
   - monsters alive and players alive → keep going
   - monsters alive, all players down → `userLost = true`, `battleFinished = true`
   - all monsters down → roll drops, `updateUsers()` (the database write), `battleFinished = true`
5. **Dismiss.** The client sends `battle_reset` → `finishBattle`, which banks
   guild boss damage, closes a dungeon run, removes the instance, and pushes
   `battle_update: undefined`.

## Turn order

`BattleUtils.generateBattleAttackOrder` sorts everyone by speed, descending:
players by `stats.agi`, monsters by `agi || level`. **A monster with `agi = 0`
falls back to its level** — every seeded monster relies on this, and it also
means seeded monsters never dodge (evasion reads `agi` directly).

The order is a list of *names*, which is why monster names in a pull are made
unique (`Poring A`, `Poring B`) — two identically named monsters would be one
slot taking two turns.

`processNextTurn` skips anyone who cannot act (dead player, dead monster) and is
bounded by the length of the order, so a fight nobody can act in advances rather
than spinning. Wrapping back to the top increments `round` and decays every
player's aggro by 20% — **once per round, not per hit**, because per-hit decay
shredded a tank's lead in a five-player party.

## The damage pipeline

Every hit — player or monster, attack or skill — goes through one path:

```
beforeDamageStep  → runs buff effects for the attacker/defender role,
                    charges skill mana
startDamageStep   → evasion roll, mitigate(), apply, log
endDamageStep     → unless deferred (area skills), afterDamageStep
afterDamageStep   → settle, tick buffs, tick cooldowns, next turn, notify
```

**This is the extension point.** Most new mechanics belong in `effects.ts` as a
new named `Buff.effect`, not as new engine code.

### Mitigation and evasion

`BattleUtils.mitigate({ raw, defense, attackerLevel })` — diminishing, never
subtractive, so a hit always costs at least 1 health:

```
reduction = min(defense / (defense + 50 + 10 × attackerLevel), 0.75)
```

Defense scales against the *attacker's* level so a gear tier does not last
forever, and `MAX_MITIGATION = 0.75` is a hard ceiling set before gear exists
that could break it. A player's effective defense adds `str / 2`
(`effectiveDefense`), which is what makes strength worth anything outside a Rune
Knight.

Evasion is `agi / 200`, capped at `MAX_EVASION = 0.2`.

### Critical hits

`crit.ts` (pure). Every character starts on `Stats.critRate = 5` percent for
`Stats.critDamage = 200` percent of the plain value, and both are raised by gear
(the accessory slot is the only source in the catalog) and by buffs
(`Buff.critRateBonus` / `critDamageBonus`, added at the moment of the roll so
nothing has to be unwound when the buff falls off). `MAX_CRIT_RATE = 75` keeps a
crit from ever becoming a certainty.

The roll goes through `BattleInstance.rollCrit`, which every damaging and
healing path calls and which logs the crit when it lands:

- **Damage** — the basic attack, and `target_enemy` casts, which roll once *per
  target* so one bad roll does not decide a whole area cast. Threat is computed
  off the crit value, so a crit is louder as well as bigger.
- **Healing** — `target_ally` and `self_restore` with `effect: healing`.
- **Nothing else.** Infusion, barriers and buffs never crit: a doubled mana
  return is worth more than any amount of crit damage, and a doubled buff is a
  different mechanic wearing the same name.

## Skills

`Skill.category` decides the branch in `processUserCast`:

| Category | Behaviour |
|---|---|
| `target_enemy` | Damage. `areaOfEffect` hits every living monster at `AREA_POWER_MULTIPLIER = 0.7` each. |
| `target_ally` | `effect` is `healing`, `infusion` or `cleanse`. Area version reaches the whole living party — the two restoring ones at the same 0.7 rate, a cleanse in full. Skips the dead. |
| `buff_self` | Puts the skill's buff on the caster. |
| `self_restore` | Heals or infuses **the caster only** — a Mage's own sustain, kept apart from `target_ally` so only a Priest can put resources on someone else. |
| `buff_party` | The skill's buff on everyone still standing, each getting their own copy. |
| `debuff_enemy` | The skill's debuff and nothing else — no damage, and so no threat. `areaOfEffect` curses every monster standing. A skill in this category without a `debuffName` is a turn that does nothing, which the seed refuses. |

**A cleanse** lifts every debuff off its targets and restores nothing. It reads
none of the skill's potency: what it is worth is whatever the fight has managed
to stick on the party, which is nothing at all against a clean one. Untargeted
and single-target, it goes to whoever is carrying the most.

Power is `attack + stats[attribute] × multiplier × masteryLevel`. Threat is
`damage × threatModifier` — decoupled from damage so a tank can hold aggro
without out-damaging anyone.

Two things that are easy to get wrong:

- **An area cast is one turn and one mana charge.** The per-target hits pass
  `deferTurnEnd` and leave `damage.skill` unset; the mana is deducted once up
  front.
- **Buffs are copied per recipient**, never shared. `decreaseOrRemoveBuffs`
  ticks the object it is given, so a shared row would drain the whole party on
  the first player's turn.

## Buffs, barriers and debuffs

- **Buffs** tick down on their holder's own turn and are dropped at zero.
- **A fight starts with what was eaten before it, and nothing else.**
  `generateUserBattleValues` keeps only `persist` buffs — those are `UserBuff`
  rows, ticked per battle where food is eaten — and drops everything a skill put
  up, because the players arrive as cached profile objects that a previous
  battle may have pushed a blessing onto. Debuffs are cleared for the same
  reason. So the battle bar shows only what *this* fight has done, and a meal
  belongs on the character sheet with the other standing numbers.
- **Neither buffs nor debuffs stack.** A second copy of the same name refreshes
  the one already there, to the longer of the two durations, so re-casting
  extends a blessing rather than doubling it and a fresh cast can never cut a
  running one short. `Buff.maxStack` deliberately does not gate this: on a meal
  it means the ceiling on *banked duration across battles*, enforced where food
  is eaten, and reading it as a copy count at the table would turn two dinners
  into two multipliers.
- **`second_wind`** catches the blow that would kill you and is consumed, leaving
  you at 30% health — what a party can buy instead of bringing a Priest.
- **`barrier`** is borrowed health, spent before real health, oldest first. Its
  size is locked in from the caster's stats when raised, so it outlives changes
  to those stats. Worth most against many small hits — the opposite of the
  defense curve.
- **`regeneration`** is a heal paid in instalments: it hands its holder a flat
  amount at the top of each of *their own* turns, the mirror of poison and
  ticked in the same place (`startPlayerTurn`). The amount is locked in from the
  caster the way a barrier's pool is, so a Priest's blessing is worth the
  Priest's intelligence wherever it ends up. It is paid **before** poison, so a
  regeneration large enough to out-heal a burn saves the player rather than
  arriving on a corpse, and it logs only what actually landed.
- **A buff needs no `effect` at all** to be worth casting. `critRateBonus` and
  `critDamageBonus` are read off the row at the moment of the roll, so a
  blessing that only sharpens crits — the Priest's `Inspired` — is two columns
  and no code.
- **Debuffs** sit on their carrier for the fight and are **never persisted**.
  Effects: `defense_down`, `attack_down`, `poison`, `burn`, `stun`.
  - **`poison` and `burn` are the same tick priced two different ways.** Poison
    costs a share of what it is stuck on, capped at `MAX_POISON_PER_TURN = 25%`
    a turn — which means it is worth more the bigger the enemy, and a potency
    tuned against a map monster is a free quarter of a boss. A burn instead
    carries a flat `amount`, locked in from the caster's
    `attribute × multiplier × mastery` when it lands, the way a barrier's pool
    is. Point a burn at a guild boss and it is worth exactly what it was worth
    on a Poring, which is why the Priest's Holy Fire is one.
  - Neither is credited to anyone's damage total, because the guild boss pays
    out on hits landed.
  - On a monster they are paid at the top of its own turn
    (`processMonsterAttack`), so a two-turn debuff is two of its swings whatever
    the party size — and that is also the only place that still runs when a stun
    costs it the turn.
  - **A player carries them too**, paid the same way at the top of their turn
    (`startPlayerTurn`): poison and burn come off the pool they walked in with,
    a stun costs them the slot, and the shred and the weakening are read at the
    moment they are hit or swing. Nothing in the game applies one yet — monsters
    have no skills — so today they arrive from the debug panel, but the reads
    are wired so a monster ability would need no engine work.
  - **The only way one comes off early is a cleanse** (`clearDebuffs`), which is
    the Priest's, and it takes everything or nothing. A cleanse that picked which
    curse to lift would need the party reading icons before the cast, and a
    support turn is expensive enough already.

- **A monster can carry buffs**, from the same catalogue the party's come from.
  It has no per-hit hooks the way `effects.ts` gives a player, so they are read
  as plain queries like debuffs are (`buffs.ts`): `attackBonus` raises what it
  swings for, `healthBonus` cuts what it takes, capped at half. Both tick on its
  own turn.

## Choosing what to hit

A plain attack and a single-target enemy skill both take an optional
`targetName`. Unnamed, they fall to `defaultMonsterTarget` — the first monster
still standing — which is what the game did for everything before players could
pick.

`getMonsterTarget` resolves the name **and falls through to whatever is still
standing when the named one is dead.** That is the normal case in a party, not
an edge one: the client highlights a monster, three other players act, and the
pack it was aimed into is gone by the time the turn comes round. A stale pick
must never cost a swing.

## Aggro

`user.aggro` accumulates per hit; the monster targets the highest among living
players (`getHighestAggroPlayer`). Decays 20% per round.

Only damage makes noise. A `debuff_enemy` cast generates none, because there is
no number to generate it from — a support who weakens a boss should not end up
holding it.

## Enrage

`enrageAfterRound` — unset, a monster never enrages. Past that round every swing
is `1.3 ×` the last (`ENRAGE_DAMAGE_MULTIPLIER`), so an unwinnable fight ends.
Current values: guild boss **5**, dungeon boss **12**.

## Pulls

`MonstersService.findPullFromMap({ mapId, maxSize: 3 })`:

- A boss is always alone — it is the fight the map builds to.
- Anything else may bring up to two more of the map's non-boss monsters.
- Names are made unique afterwards.
- **Every extra monster is a full share of drops and experience**, so `MAX_PULL_SIZE`
  is the ceiling on what one pull can be worth.

## Rewards

`BattleService.updateStatsAndRewards` runs once per winning battle, per user, in
a transaction: tick buffs down, pay silver and exp, level up, persist remaining
health/mana, contribute to the guild task, add dropped items. Then, outside the
transaction, refresh the guild and push `user_update`.

After that: guild boss damage is banked, and a dungeon run advances a stage.

Persisting remaining health and mana is what makes a dungeon gauntlet work — the
next fight loads the party from the database on whatever they had left.

## Tests

`battle.test.ts`, `battleUtils.test.ts`, `debuffs.test.ts`, `barrier.test.ts`.
The engine is testable because `BattleInstance` takes a socket and two callbacks
and touches nothing else.
