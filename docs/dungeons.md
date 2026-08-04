# Dungeons

Three bosses fought back to back on one entry a day. `src/feature/dungeon`,
plus the entry points on `BattleService`.

**The premise:** a map is somewhere you go back to all afternoon, so what it
drops has to be rationed by chance. A dungeon is a single attempt, so it can be
tuned far above the map curve and pay properly.

## Files

| File | Owns |
|---|---|
| `dungeon.rules.ts` | Pure — entries, staleness, blockers, `toBattleMonster`, camp restore |
| `dungeon.service.ts` | Runs: who may walk in, which boss is next, settling |
| `dungeon.gateway.ts` | Reads + `dungeon_abandon` |
| `battle.service.ts` | `createDungeonBattle`, `continueDungeonRun`, `_closeDungeonRun` |
| `seed/dungeons.ts` | The three dungeons and their nine bosses |

The battle-opening events live on `BattleGateway` (`battle_create_dungeon`,
`battle_dungeon_continue`), not the dungeon gateway, because the battle list
belongs to `BattleService`. Same split the guild boss uses.

## The run

```
prepareEntry → startRun → boss 1 → completeStage → boss 2 → … → cleared
                  ↑                     ↓
             entry spent          any other exit → failRun
```

1. **`prepareEntry`** refuses, naming the reason: no such dungeon, an empty one,
   anyone in the party already inside a run, or anyone out of today's entry.
   Before any of that it calls `expireStaleRuns`, so yesterday's abandoned run is
   never what keeps a party out of today's.
2. **`createDungeonBattle`** additionally refuses a party with anyone at zero
   health — checked *before* the entry is spent, so a member left on the floor by
   an earlier fight cannot cost the party the day.
3. **`startRun`** upserts a `DungeonEntry` for everyone and creates the
   `DungeonRun` with its members, in one transaction. **The entry is spent
   walking in, not on a win.**
4. Each kill runs the normal reward path, then `completeStage` bumps
   `DungeonRun.stage`. On the last boss it sets `status = 'cleared'` and notifies.
5. **`continueDungeonRun`** opens the next boss: refuses if a fight is still
   live, removes the finished instance, runs the camp restore, re-reads the party
   from the database, and stands the next boss up.

## Entries

One per player **per dungeon** per UTC day, stored as a timestamp on
`DungeonEntry.usedAt` and compared with `isNewDay` — the same rule stamina and
the guild boss entry use, so every player's day rolls over together.

The entry is spent **party-wide**: one member out of entries keeps everyone out.
`entryBlockers` returns *all* of them in one pass so the client can name them at
once rather than discovering them one attempt at a time.

## Failing a run

`_closeDungeonRun` fails the run on **any exit that is not a kill**:

- a wipe, then dismissing the results screen
- running from the fight (`battle_reset`)
- an Escape Powder (`battleEffect: 'escape'`)
- walking out of the results screen after winning a boss
- `dungeon_abandon` from the dungeon tab

`failRun` no-ops on a run that is already `cleared`, which is what makes leaving
after the final boss safe.

**Anything new that ends a battle early must call `_closeDungeonRun` alongside
`_bankGuildBossDamage`**, or it leaves a run standing that the party can resume
for free.

## The camp restore

Between bosses every member is brought **up to** 30% of their maximum health and
mana (`CAMP_RESTORE`), never down. Two reasons:

- The gauntlet is meant to be fought on one health bar — that is what makes the
  third boss the hard one rather than just the biggest.
- Without it, anyone who fell on the previous boss would be persisted at zero
  health and could not be brought back, since nothing heals outside combat.

## Dungeon bosses

`DungeonMonster` is its own table, not a `Monster`:

- no `mapId`, so it can never turn up in a random pull
- `stage` (unique per dungeon) fixes the order
- the numbers sit well above the map curve

`toBattleMonster` dresses one up for the battle engine, negating the id and
setting `mapId = 0` — the same trick the guild boss uses, so a dungeon boss can
never collide with a real `Monster` id or credit a guild task.

Enrage is round **12** — generous, there only to end a stalemate.

## The numbers

`seed/dungeons.ts` derives everything from the same level curve every monster
uses (`level × 10 + level² × 0.6`), weighted per stage:

| Stage | health × | attack × lvl | defense × lvl | silver × lvl | exp × lvl |
|---|---|---|---|---|---|
| 1 | 5 | 1.2 | 1.2 | 20 | 20 |
| 2 | 6.5 | 1.4 | 1.2 | 30 | 28 |
| 3 | **10** | **1.8** | **2** | **80** | **60** |

A map boss is `× 5` health at `× 1` attack for comparison. `agi` is left at 0 on
purpose, exactly like every map boss — the difficulty is meant to be the size of
the numbers, not a coin flip on whether the party's turn happened.

Loot follows a rule rather than a list (`gearDrops`): stage 2 drops the band's
three armour chest pieces at 18%, stage 3 drops **all five tier weapons at 12%
each** — so a run is never wasted on a class the party did not bring — plus
materials per boss.

Seeded dungeons: Forgotten Crypt (rec. 28, tier 3 gear), Scorched Tomb (rec. 40,
tier 4), Demon Sanctum (rec. 52, tier 5). `recommendedLevel` is advisory only;
nothing blocks an under-levelled party.

## Client payload

`dungeon_status` carries `{ run, entries }` — the caller's active run and every
entry their **party** holds, since the entry is spent party-wide. Pushed to every
run member whenever a run changes.

A dungeon battle's `battle_update` carries
`dungeon: { runId, name, stage, totalStages }`, which is how the results screen
knows to offer the next boss instead of a rematch.
