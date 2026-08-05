# Data model

47 models in `src/core/prisma/schema.prisma`. The schema itself is heavily
commented — this page groups the models by domain and records the invariants
that are *not* visible in a column definition.

## Conventions across the whole schema

- **`User.email` is the primary key everywhere in practice.** Almost every
  relation to a player is `userEmail String` referencing `User.email`, not the
  autoincrement `id`. New tables should follow suit.
- **Content tables are matched by name, never by id.** Autoincrement ids differ
  between `dev.db` and the deployed Turso database, so the seed resolves
  everything through helpers like `itemIdByName` / `mapIdByName`. Never hard-code
  an id.
- **Player rows cascade, content rows restrict.** Deleting a user takes their
  inventory, stats, mail and run memberships with them; deleting an item is
  blocked while anything points at it.
- Daily resources store a **timestamp**, not a flag, and are compared with
  `isNewDay` from `users.rules` — a UTC calendar-day comparison, so every
  player's day rolls over at the same instant.

## Player

| Model | Notes |
|---|---|
| `User` | Identity, silver, admin flag, and the hub every other table hangs off. `partyId` is nullable — most players are in no party. |
| `Stats` | Level, exp, health/mana with their maxes, attack, str/agi/int, `defense`, `critRate` / `critDamage` (5% for 200%, before gear), and the daily `stamina` / `maxStamina` / `staminaRefilledAt`. `bonusMaxStamina` remembers how much of the ceiling a guild blessing bought, so a profession level-up can recompute `maxStamina` without spending it. One per user. |
| `Appearance` / `Head` | Cosmetics. `Head` is the catalogue, keyed `[name, gender]`. |
| `Class` | The combat archetype chosen at creation: per-level stat block plus the skill list. **Renamed from Profession** — that name now means a trade. |
| `LearnedSkill` | A skill a player owns, with `masteryLevel` (multiplies its power) and `equipped`. |
| `UserBuff` / `Buff` | A buff on a player, and the catalogue row it copies. `Buff.effect` is a named string the battle engine branches on. `attackBonus` / `healthBonus` / `critRateBonus` / `critDamageBonus` are percentages the effect reads off the row, so a new meal or blessing is a seed entry rather than new code. |
| `Discord` | Links a `discordId` to an email. One per user. |
| `Notification` | Things that happened while away (a service of theirs was hired). Purely informational — rewards are already paid when the row is written. |
| `Mail` | Can carry silver and one item stack; `claimed` gates the payout. |

## Items and the market

| Model | Notes |
|---|---|
| `Item` | The catalogue. `category` is one of `weapon`/`armor`/`legs`/`boots`/`accessory`/`consumable`/`material`. Stat columns are nullable and only meaningful for equipment. A consumable may point at a `Buff`, and `battleUse` / `partyWide` / `battleEffect` decide how it may be drunk. |
| `InventoryItem` | A stack a player owns. **Unique on `[userEmail, itemId, quality, enhancement, equipped, locked]`** — that composite is why identical items merge and a +7 sword does not merge with a +0 one. |
| `MarketListing` | One inventory row put up for sale. `inventoryId` is unique, so a listed stack cannot also be equipped or consumed. |
| `StoreProduct` / `UserPurchase` | Real-money products and the RevenueCat transactions that bought them. `received` and `refunded` are the state machine. |

## Combat content

| Model | Notes |
|---|---|
| `Map` | A ten-level band. Its image is its boss. |
| `Monster` | Belongs to a map. `boss` makes it fight alone. **`agi` left at 0 falls back to the monster's level for turn order and means it never dodges** — every seeded monster relies on this. |
| `Drop` | A monster's loot table, unique on `[monsterId, itemId]`. |
| `Skill` | Category (`target_enemy`, `target_ally`, `buff_self`, `self_restore`, `buff_party`), `attribute` × `multiplier`, `manaCost`, `cooldown`, `threatModifier`, `areaOfEffect`, and optional `buff` / `debuff`. |
| `Debuff` | The enemy-side mirror of `Buff`. **Never persisted onto a monster** — it lives on the in-memory battle instance for one fight. This table is only the catalogue a skill points at. |

## Professions (trades)

| Model | Notes |
|---|---|
| `Profession` | Six of them, `kind` is `gathering` or `crafting`. `canEnhance` gates the enhancement service. |
| `UserProfession` | One per learned trade, with its own level and experience. |
| `GatheringNode` / `GatheringDrop` | A spot; paying its stamina cost rolls every drop once, independently. |
| `Recipe` / `RecipeIngredient` | Ingredients plus stamina in, one item out. Crafting never fails — `requiredLevel` is the gate, not a roll. |
| `ServiceOffer` | A crafter selling their stamina at a price per point. One per crafter. |
| `Commission` / `UserCommission` | Standing NPC contracts — the price floor under crafted goods. **Which contracts a player is offered is derived from their email and the day, not stored**; a `UserCommission` row exists only once goods are handed over, and `offeredOn` (a `YYYY-M-D` string) is what caps it to once a day. |

## Guild

| Model | Notes |
|---|---|
| `Guild` | Level, experience, `taskPoints` (soulshards), two message boards. |
| `GuildMember` | Role, `permissionLevel`, `contribution`, `guildTokens`, and `bossEntryUsedAt` — the daily boss entry. |
| `GuildApplication` | A pending join request. |
| `GuildTask` / `CurrentGuildTask` | A kill count on one map; one active task per guild. |
| `GuildBoss` | The catalogue. **Its columns are the easy-difficulty numbers** — harder difficulties multiply them, see `guildBoss.rules.scaleBoss`. |
| `CurrentGuildBoss` | The boss a guild has standing. **Its health pool persists between fights**: the guild wears it down over days, one entry per member per day. |
| `GuildBossDamage` | `damage` is the *score*, shared evenly across a party, and decides the token payout. `dealtDamage` is what the member personally hit for, kept only so the ranking can show who carried. Goes away with the boss. |
| `GuildBlessing` | Guild-wide stat bonuses: health, mana, str/agi/int, defense, critRate, critDamage, and daily profession `stamina`. Each column holds the **total granted**, not a level — the level is that total over the stat's `UPGRADE_FACTOR`, which is what prices the next one. |
| `GuildStoreProduct` | Priced in guild tokens. |

## Dungeon

See [dungeons.md](dungeons.md) for the behaviour.

| Model | Notes |
|---|---|
| `Dungeon` | Name, image, description, `recommendedLevel` (advisory only), `sortOrder`. |
| `DungeonMonster` | The boss table. **Deliberately not a `Monster`**: no `mapId`, so it can never appear in a random pull, and `stage` (unique per dungeon) fixes the fight order. |
| `DungeonDrop` | Its loot table, the mirror of `Drop`. |
| `DungeonEntry` | One row per player per dungeon holding `usedAt`. Unique on `[userEmail, dungeonId]` — there is no history to keep, only the last entry. |
| `DungeonRun` / `DungeonRunMember` | The party's attempt, outliving the individual battles so a disconnect can be resumed. `status` is `active`/`cleared`/`failed`. |

## Party

`Party` is just an id and a `leaderEmail`; membership is `User.partyId`. **Open
state and chat are not in the database** — they live in `PartyState`, in memory.
