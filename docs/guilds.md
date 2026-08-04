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

`GuildBlessing` — a shared stat bonus every member receives. Unlock costs 100
guild tokens, each upgrade another 100. `UPGRADE_FACTOR` in `constants.ts`
scales the step: health and mana move 5 per upgrade, str/agi/int 1.

## Store

`GuildStoreProduct` — ordinary items priced in guild tokens.
