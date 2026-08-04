# Poring Adventure API — reference docs

Written to be **read by an agent starting cold**. Each file answers "how does
this system work and where does it live", so a session can load one file
instead of reading a dozen source files to rebuild the same picture.

## How to use these

1. **`CLAUDE.md` at the repo root** is loaded automatically and tells you which
   file below to open for the task at hand. Start there.
2. **Open one file, not the folder.** They are split so you never have to read
   about crafting to change the battle engine.
3. **For symbol-level questions — "where is X called from", "show me the source
   of Y" — use CodeGraph instead** (`codegraph explore "<question>"`, or the
   `codegraph_explore` MCP tool). It is indexed for this repo and is cheaper and
   more current than any prose. These docs cover what CodeGraph cannot: why a
   system is shaped the way it is, and how pieces fit together across files.

## The files

| File | Read it when |
|---|---|
| [architecture.md](architecture.md) | Adding a feature, a module, or a websocket event; anything about caching, transactions or auth |
| [data-model.md](data-model.md) | Touching the schema, or you need to know what a table means |
| [websocket-events.md](websocket-events.md) | You need the wire contract — every inbound event and every server push |
| [combat.md](combat.md) | Anything inside `feature/battle`: turns, damage, skills, buffs, debuffs, rewards |
| [progression.md](progression.md) | Classes, levels, stats, skills, stamina, buffs on a player |
| [economy.md](economy.md) | Items, quality/enhancement, inventory, market, the six professions |
| [guilds.md](guilds.md) | Guilds, tasks, the guild boss, blessings, the token store |
| [dungeons.md](dungeons.md) | The three-boss daily gauntlet |
| [social-and-platform.md](social-and-platform.md) | Party, mail, notifications, the Discord bot, purchases, admin tools |
| [content-seeding.md](content-seeding.md) | Adding monsters, items, gear, recipes, bosses or dungeons |

## Two other documents in the repo root

`plan.md` and `combat_plan.md` are **design documents**, not references: they
record why the economy and the combat system were rebuilt, what was measured,
and what was rejected. Read them when you need the reasoning behind a number.
These docs describe what is there now.

## The client

The React client lives in a sibling repository at `../poring-adventure`, with
its own `docs/` folder and `CLAUDE.md`. The two talk over websockets only —
[websocket-events.md](websocket-events.md) is the contract between them.

## Keeping these current

A system change and its doc update belong in the same commit. A doc that lies is
worse than no doc: it is loaded automatically and believed.
