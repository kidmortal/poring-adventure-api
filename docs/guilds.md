# Guilds

`src/feature/guild` — one module, six services, split by concern:

| Service | Owns |
|---|---|
| `guild.service.ts` | Listing, reading, quitting, kicking |
| `guildApplication.service.ts` | Join requests |
| `guildTask.service.ts` | The kill contract and its payout |
| `guildBoss.service.ts` | The standing boss, entries, damage banking |
| `guildBlessing.service.ts` | Guild-wide stat bonuses |
| `guildStore.service.ts` | The token shelf |
| `guild.repository.ts` | Every cached read, and the guild cache key |
| `guild.permissions.ts` | `requireMember({ userEmail, level })` |
| `guild.rules.ts` / `guildBoss.rules.ts` | Pure maths |

## Permissions

`GuildPermission` in `guild.permissions.ts`:

| Level | Actions |
|---|---|
| 1 | `MANAGE_TASKS`, `MANAGE_APPLICATIONS` |
| 2 | `MANAGE_BLESSINGS`, `MANAGE_BOSS` |

`requireMember` resolves membership, checks the level, **sends the refusal
itself** and returns `undefined` when the action must not proceed. Every guarded
action starts with it.

Summoning a boss sits at level 2 rather than 1 because it binds the whole guild
to a health pool for days.

## Two currencies

- **`Guild.taskPoints`** ("soulshards") — the guild's own pool, which is what
  levels it up.
- **`GuildMember.guildTokens`** — a member's personal currency, spent in the
  guild store.

Both are paid by the same events, which is what makes guild activity worth doing
for the guild *and* for the individual.

## Guild task

A kill count on one map. `accept_guild_task` creates a `CurrentGuildTask`
(one at a time); `contributeToGuildTask` is called by the battle reward loop on
every kill whose `mapId` matches, decrementing `remainingKills` and crediting
the killer's `contribution` and `guildTokens`; `finish_current_task` pays
`taskPoints` to the guild and distributes tokens to every member.

Two implementation notes worth keeping:

- `contributeToGuildTask` **returns the guild id rather than pushing**, because
  re-reading a whole guild inside the caller's transaction is far too slow. The
  caller pushes after its commit.
- `refreshGuild` is documented "never call inside a transaction" for the same
  reason.
- A dungeon or guild boss kill has `mapId = 0`, which matches no task — those
  kills deliberately do not count.

## Guild boss

The system dungeons were later modelled on, and the closest thing to read before
touching either.

- `GuildBoss` rows carry **easy-difficulty numbers**. `scaleBoss` multiplies them
  by the chosen difficulty (`easy`/`normal`/`hard`/`nightmare`), and **health
  climbs faster than the reward** — nightmare is 25× health for 14× reward — so
  a hard boss is a guild commitment, not a shortcut for one strong player.
- `CurrentGuildBoss.health` **persists between fights.** The guild wears one boss
  down over days.
- **One entry per member per UTC day** (`GuildMember.bossEntryUsedAt`,
  `hasEntry`). `prepareFight` refuses a party containing a non-member or anyone
  out of entries, naming them; `consumeEntries` spends them before the fight
  starts.
- The fight itself enrages after round **5** — the pool is far too big for one
  party, so the boss turns on them rather than letting an unwinnable fight drag.
- `applyDamage` banks whatever the fight did, **however it ended** — won, wiped
  or run from. `BattleInstance.consumeDamage()` empties itself so a fight settled
  twice cannot bank twice.

### How the payout is split

Deliberately two numbers (`guildBoss.rules.ts`):

- **`damage`** — the score. `shareDamageEvenly` splits a party's total evenly
  across everyone who walked in, remainder handed out a point at a time so
  nothing is lost to flooring. The fight costs all of them an entry, so it pays
  all of them the same — a healer who never landed a hit banks as much as the
  one who did.
- **`dealtDamage`** — what each actually hit for, kept only so the ranking can
  show who carried.

On the kill, `splitTokensByDamage` divides the token pool by banked score;
anyone who contributed gets at least one token, and the flooring remainder goes
to the top scorer. Shards go to the guild.

`partyKeyFor` identifies the group that fought together so the ranking can show
them linked.

## Blessings

`GuildBlessing` — a shared stat bonus every member receives, paid for in
soulshards (`Guild.taskPoints`). Unlocking the shrine costs 100.

**A column stores the total stat granted, not a level.** The level is that total
divided by the stat's step, which is what `blessingLevel` in `guild.rules.ts`
reads back. Storing the total is what lets the bonus be handed to members as it
is bought, with no second column to keep in step.

`UPGRADE_FACTOR` in `constants.ts` is that step, and is the only thing that
separates a cheap blessing from an expensive one — every blessing costs the
same per level:

| Blessing | Per level |
|---|---|
| `health`, `mana` | 5 |
| `critDamage` | 5 — percent of a normal hit, where one point is not felt |
| `str`, `agi`, `int`, `defense`, `critRate` | 1 |
| `stamina` | 1 point of daily profession stamina |

### What a level costs

`blessingUpgradeCost({ level })` — `100 × 1.35^level`, rounded. The first level
is 100, the twentieth about 29,700, and `MAX_BLESSING_LEVEL` stops it there. A
flat 100 forever meant a mature guild's shard income was not a decision; the
compounding is what makes spreading levels across the blessings members
actually use a different plan from pushing one alone.

Both `unlock` and `upgrade` check affordability **before** opening the
transaction and push the refusal, naming the price and what the guild holds.

### The stamina blessing

The only one that does not go through `increaseUserStats`, because daily
stamina is not a combat stat. `UserStatsService.raiseMaxStamina` increments
`Stats.maxStamina` **and** `Stats.bonusMaxStamina`.

The second column is not redundant: levelling a profession recomputes
`maxStamina` from the trade's level (`_syncMaxStamina` →
`maxStaminaForProfession({ level, bonus })`), and without somewhere to remember
the guild's purchase that recompute would spend it. Only the ceiling moves —
the day's remaining bar is left alone, so buying the blessing at teatime is not
a free refill.

Blessings are applied to whoever is a member **at the moment of purchase**.
Joining later grants nothing retroactively, and quitting takes nothing back.

## Store

`GuildStoreProduct` — ordinary items priced in guild tokens.
