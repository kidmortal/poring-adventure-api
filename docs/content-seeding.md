# Content and seeding

All game content — maps, monsters, items, gear, skills, recipes, bosses,
dungeons — is defined in `src/core/prisma/seed/` and written by `yarn seed`.

```bash
yarn seed                                          # local dev.db
TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… yarn seed  # the deployed database
```

## Three rules the seed lives by

1. **Idempotent.** Rows are matched by their natural key, so running it again
   refreshes the numbers on what is there and creates only what is missing.
2. **It never deletes.** Content pulled out of a seed file stays in the database
   until removed by hand. (`pruneProfessionDrops` is the one deliberate
   exception, and it deletes by rule rather than by list.)
3. **Never hard-code an id.** Autoincrement ids differ between `dev.db` and
   Turso. Resolve through `itemIdByName`, `mapIdByName` or `upsertByName`, all
   in `seed/client.ts` alongside the Prisma connection every step shares.

`upsertByName` exists because several content models (`Item`, `Skill`,
`Monster`, `Map`) carry a name that is unique in practice but not in the schema,
so Prisma's `upsert` is unavailable to them.

## Step order

`seed/index.ts` runs `STEPS` in order, and the order matters — each step resolves
content the previous ones created:

```
seedBuffs            → seedItems (a meal points at its buff)
seedEquipment, seedHeads, seedClasses
backfillDefense      → the one step that touches player rows
seedDebuffs          → seedSkills (a skill points at its debuff)
seedMonsters         → seedEquipmentDrops (needs gear and monsters)
seedProfessions      → seedGatheringNodes, seedRecipes
pruneProfessionDrops → reads nodes and recipes to know what a monster must not drop
seedCommissions      → needs professions and everything they can be asked for
seedGuildTasks, seedGuildBosses, seedGuildStore
seedDungeons         → needs the gear catalog and its bosses' materials
seedStoreProducts
```

## Derived numbers, not typed ones

Every content file computes its stats from a curve rather than listing them, so
the whole game moves together when a curve is retuned:

| File | Curve |
|---|---|
| `monsters.ts` | `normalStats(level)` — `health = level×10 + level²×0.6`, `exp = level×6`; `bossStats` = 5× health |
| `equipment.ts` | Five tiers, one per map band. Armour, weapon and accessory stats derived from tier, line and slot weight |
| `dungeons.ts` | The monster curve weighted per stage — see [dungeons.md](dungeons.md) |
| `guild.ts` | Boss rows hold easy-difficulty numbers; `scaleBoss` does the rest |

Nothing is written by hand except the asset name, the level, and which line it
belongs to.

## Art is validated

`seed/assets.ts` holds the file names that **actually exist on the Sirv CDN**,
and `materialImage` / `consumableImage` / `skillImage` throw on a name that is
not in the list.

That guard is there because it was needed: an earlier pass invented a dozen
plausible file names that had never been uploaded, and the seed happily created
items whose artwork was a broken image. **When new art is uploaded, add its file
name to `assets.ts` first.**

Monster sprites are the exception — they are `https://kidmortal.sirv.com/monsters/<ASSET>.gif`
and are not validated, so reuse an asset name that already appears in
`monsters.ts` unless you know a new one exists.

## The economy boundary

`pruneProfessionDrops` deletes from monster loot tables everything a gathering
node or a recipe produces. Ore, herbs, fish, potions and cooked food are the
trades' entire reason to exist; if a fighter can farm them, nobody buys them and
nobody levels a crafter.

**Monsters keep only what no profession makes** — slime jelly, bones, wings, and
the gear `seedEquipmentDrops` places. Respect that boundary when adding drops
(dungeon drops are not pruned automatically, so check by hand).

## Adding content

| Adding | Edit | Watch for |
|---|---|---|
| A monster | `monsters.ts` `MAPS` | Sprite must exist; stats come from the curve |
| A map | `monsters.ts` `MAPS` + a tier in `equipment.ts` | Its image is its boss |
| An item | `items.ts` | Art must be in `assets.ts` |
| Gear | `equipment.ts` `ARMOR_SETS` / `WEAPONS` / `ACCESSORIES` | Stats are derived from the tier. Accessories are the only source of crit; a `grade: 'dungeon'` piece is left out of the map tables and claimed by `dungeons.ts` |
| A recipe or node | `professions.ts` | Then re-run so `pruneProfessionDrops` clears the new outputs off monsters |
| A commission | `commissions.ts` | |
| A guild task or boss | `guild.ts` | Tasks never wear a boss sprite — progress counts any kill on the map |
| A dungeon | `dungeons.ts` | Bosses are keyed on `[dungeonId, stage]`, so renaming one moves its row |
| A real-money product | `store.ts` | Must match the RevenueCat product id |

## One-off migrations

`core/prisma/retireLegacyConsumables.ts` and `retireLegacyEquipment.ts` are
standalone scripts that remove content an older roster left behind and mail
players back its value. They are not part of `yarn seed`.
