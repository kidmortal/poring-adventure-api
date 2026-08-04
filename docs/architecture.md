# Architecture

NestJS 10 on Node. **There is essentially no REST API** — the game is played
over a single Socket.IO connection. HTTP serves only four things, none of them
gameplay: `POST /purchase/webhook` (RevenueCat), and `MainController`'s `/`,
`/br/privacy`, `/br/terms` and `/version` (static pages from `public/`, plus the
deployed commit hash the client's version check reads).

## Layout

```
src/
  core/          infrastructure — nothing game-specific lives here
    app/         AppModule, the one controller
    auth/        Firebase token validation for the socket handshake
    prisma/      PrismaService, schema, migrations, seed/
    websocket/   the gateway, the service that pushes, guards, exception filter
    http/        HTTP exception filter
  feature/       one folder per game system, each a Nest module
  integrations/  firebase, onesignal (push), revenuecat (purchases)
  types/dto/     global `declare type` DTOs for websocket payloads
  utilities/     utils.ts (chance, damage rolls, level maths), sentry, imageDrawer
```

### Anatomy of a feature module

Not every feature has every file, but the roles are consistent:

| File | Role |
|---|---|
| `x.gateway.ts` | `@SubscribeMessage` handlers. Pulls `email` off the socket, logs, delegates. **No logic.** |
| `x.service.ts` | The behaviour. Owns validation, database writes and pushes. |
| `x.repository.ts` | Present where reads are cached (`guild`, `market`, `party`, `users`) — the single place that knows the cache keys. |
| `x.rules.ts` | **Pure functions. No database, no cache, no sockets.** This is where the unit tests point. |
| `x.module.ts` | Wiring. |
| `x.test.ts` | Jest, colocated. |

**The `.rules.ts` convention is the most important one here.** Every system with
interesting arithmetic pulls it into a pure module so it can be tested without a
Nest container: `market.rules` (tax), `profession.rules` (stamina, enhancement,
craft quality), `guildBoss.rules` (difficulty scaling, damage sharing),
`dungeon.rules` (entries, camp restore), `users.rules` (day rollover, vitals),
`items.rules` (quality and enhancement stat blocks), `commission.rules` (the
daily board). When adding maths, put it there first.

## The request lifecycle

1. Client connects with `auth: { accessToken }`.
2. `WebsocketGateway.handleConnection` calls `AuthService.validateWebsocketConnection`,
   which verifies the Firebase token and **writes the resolved email onto
   `socket.handshake.auth.email`**. A failed check disconnects the socket.
3. The socket is pushed onto `WebsocketService.wsClients` — a plain in-memory
   array — and the client is sent `authenticated`.
4. Every gateway handler reads its actor from `client.handshake.auth.email`.
   **Never trust an email that arrived in a payload.**
5. Handlers return a value (Socket.IO acknowledgement — the client's `asyncEmit`
   resolves with it) and/or push events to other sockets.

### Guards

- `WebsocketAuthEmailGuard` — requires the resolved email. On nearly every gateway.
- `WebsocketDiscordServiceGuard` — restricts a gateway to the bot's own socket,
  identified by the reserved email `discord`. The Discord events act on behalf of
  an arbitrary `discordId`, so this guard is the only thing between a player and
  someone else's account.
- `AdminGuard` — `feature/admin/admin.guard.ts`, checks the `User.admin` column.
- `ThrottlerGuard` — global, 60 requests per 30s.

## Pushing to clients

`WebsocketService` is the only way to reach a client:

```ts
sendMessageToSocket({ email, event, payload })  // every socket that email has open
sendTextNotification({ email, text })           // → 'notification' (a toast)
sendErrorNotification({ email, text })          // → 'error_notification' (a red toast)
broadcast(event, message)                       // everyone connected
```

**A handler's return value and its pushes are different channels.** Most
mutations return a bare `boolean` and do the real work by pushing the updated
state — that is why a refusal is usually `sendErrorNotification` plus `false`
rather than a thrown exception. Follow the `_deny` / `_denyUndefined` helper
pattern in `guildBoss.service.ts` and `dungeon.service.ts`.

## Caching

`@nestjs/cache-manager`, in-memory, registered **per module** with a 10 minute
TTL. Keys in use: `user_<email>`, `users_page_<n>`, `user_count`,
`map_monsters_<mapId>`, `map_monsters`, `guild_<id>`, `guild_bosses`,
`dungeons`.

Two things to know:

- **`_cached` hands back the object it is holding, not a copy.** The battle
  engine mutates the user objects it is given, so any code path that reads a
  user, mutates it, and expects the next read to be fresh must clear the cache —
  `UsersRepository.clearUserCache({ email })`, which
  `UsersService.notifyUserUpdateWithProfile` already does.
- `MonstersService.findAllFromMap` deliberately `structuredClone`s the cached
  map, because a pull can contain two of the same monster row.

## Transactions

`prisma.$transaction(async (tx) => …, TRANSACTION_OPTIONS)` from
`core/prisma/types/prisma.ts`. The explicit options raise the interactive
timeout to 20s because the deployed database is remote (Turso/libSQL over the
network) and Prisma's 5s default is not enough for multi-write flows like battle
rewards or a hired craft.

Rules that have already bitten:

- Pass `tx` down; every service that writes takes an optional `tx`.
- **Never push a socket event from inside a transaction** — push after the
  commit, or the client re-reads state that is not there yet. `refreshGuild` is
  explicitly documented as "never call inside a transaction".

## Database

SQLite through the libSQL driver adapter, so the same schema runs on a local
`dev.db` and on hosted Turso. `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` pick
which; blank means local.

Migrations are hand-written SQL under `core/prisma/migrations/<timestamp>_<name>/`
— the SQLite provider cannot do everything `migrate dev` wants, and the files
carry comments explaining the change. Apply with `npx prisma migrate deploy`.

## Commands

```bash
yarn dev            # nest start --watch
yarn build          # prisma generate && nest build
yarn test           # jest, *.test.ts colocated in src
yarn lint           # eslint --fix (prettier runs as an eslint rule)
yarn seed           # idempotent content seed; TURSO_* env vars target the deployed db
```

## Things that will surprise you

- **Battles live in memory**, in `BattleService.battleList`, ticked by a cron
  every 3 seconds. A restart drops every fight in progress.
- **Party open-state and chat live in memory too** (`party.state.ts`). Both are
  documented as making the API single-instance; a second process needs Redis.
- The seed is **idempotent and never deletes**. Content pulled out of a seed file
  stays in the database until removed by hand.
