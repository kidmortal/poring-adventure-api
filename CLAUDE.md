# Poring Adventure — API

Co-op RPG backend. **NestJS, websocket-only** (Socket.IO; the single HTTP
endpoint is the RevenueCat webhook). SQLite via libSQL, so the same schema runs
on local `dev.db` and hosted Turso.

The React client is a sibling repository at `../poring-adventure`.

## Loading context — cheapest path first

1. **CodeGraph is indexed for this repo** (`.codegraph/` exists). For anything
   symbol-level — "where is X called from", "show me Y", "what breaks if I
   change Z" — use it *before* grep or Read:
   `codegraph explore "<question>"`, or the `codegraph_explore` MCP tool.
2. **`docs/` answers how systems fit together**, which CodeGraph cannot. Open
   the one file that matches the task:

| Task | Read |
|---|---|
| Anything at all, first time in the repo | [docs/architecture.md](docs/architecture.md) |
| Schema, or "what does this table mean" | [docs/data-model.md](docs/data-model.md) |
| Adding/changing a websocket event | [docs/websocket-events.md](docs/websocket-events.md) |
| Battle engine, skills, buffs, debuffs | [docs/combat.md](docs/combat.md) |
| Classes, levels, stats, stamina | [docs/progression.md](docs/progression.md) |
| Items, market, the six trades | [docs/economy.md](docs/economy.md) |
| Guild, tasks, guild boss, blessings | [docs/guilds.md](docs/guilds.md) |
| Dungeons | [docs/dungeons.md](docs/dungeons.md) |
| Party, mail, Discord bot, purchases, admin | [docs/social-and-platform.md](docs/social-and-platform.md) |
| Adding monsters, items, gear, recipes, dungeons | [docs/content-seeding.md](docs/content-seeding.md) |

`plan.md` and `combat_plan.md` in the root are **design documents** — the
reasoning behind the economy and combat rebuilds. Read them for *why* a number
is what it is; `docs/` is for what exists.

## Conventions worth knowing before the first edit

- **Gateways hold no logic.** They read `client.handshake.auth.email`, log, and
  delegate. Never trust an email from a payload.
- **Pure maths goes in `<feature>.rules.ts`** — no database, no cache, no
  sockets. That is where the unit tests point, and where new arithmetic belongs.
- **Refusals are pushed, not thrown.** `sendErrorNotification` + `return false`
  (or the `_deny` / `_denyUndefined` helpers). Most mutations return a bare
  boolean and do the real work by pushing state.
- **Never push a socket event from inside a transaction.** Commit, then push.
- Multi-write transactions must pass `TRANSACTION_OPTIONS` — the remote database
  outruns Prisma's 5s default.
- Cached reads hand back the object they hold, not a copy. Mutating a user means
  clearing `user_<email>`.
- Migrations are hand-written SQL under `src/core/prisma/migrations/`.
- Content is seeded by natural key, never by id — ids differ between dev.db and
  Turso.

## Commands

```bash
yarn dev            # nest start --watch
yarn build          # prisma generate && nest build
yarn test           # jest — *.test.ts colocated in src
yarn lint           # eslint --fix (prettier runs as an eslint rule)
yarn seed           # idempotent content seed
```

Tests and `tsc --noEmit` must be clean before anything is considered done.

## Commit messages

This repository does **not** use conventional-commit prefixes. Subjects are
lowercase declarative sentences describing what the change does for the game,
in the same voice as the code comments — often two clauses joined by "and" or
"or". Match the existing history:

```
give the priest a party to bless, and a mage spells it can explain
fight packs instead of one monster, and let a skill leave something behind
make monsters stop selling what the trades are for
answer the client when a handler throws, and stop holding a transaction open
```

Body wraps at 80 and explains **what and why**, not how. One change per commit.

(The sibling client repo uses bee-stylish `<type>(<scope>): <subject>` instead —
see its `CLAUDE.md`. The two are deliberately different; do not cross them.)

## Keeping the docs true

**When you change a system, update its `docs/` page in the same commit.** These
files are loaded automatically and believed; a stale one is worse than none.
