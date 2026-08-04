# Social and platform

Party, mail, notifications, the Discord bot, purchases, and admin tooling.

## Party

`src/feature/party`. A `Party` row is only an id and a `leaderEmail`;
membership is `User.partyId`.

**The volatile half is not in the database.** `PartyState` (`party.state.ts`)
holds, in memory:

- which parties are listed as open (the browsable list)
- each party's chat log

Both are dropped on restart, and both are documented as **making the API
single-instance** — a second process needs Redis behind this.

`party.notifier.ts` centralises the pushes: `party_data` (membership),
`party_status` (`{ chat, isPartyOpen }`) and `party_invite`.

Why the party matters elsewhere: **every battle pulls the whole party in
automatically** (`BattleService._gatherParty`), and both the guild boss entry and
the dungeon entry are spent party-wide.

## Mail

`src/feature/mail/mail.service.ts`. A `Mail` row can carry silver and one item
stack; `claimed` gates the payout and `visualized` drives the unread badge.
`claimAll` settles every unclaimed row in one transaction. `sendGift` is the
player-to-player path.

Mail is the game's universal delivery mechanism — store purchases, admin gifts
and refunds all arrive this way.

## Notifications (in-game)

`Notification` rows record something that happened while a player was away —
currently a service of theirs being hired, and what it earned. **Purely
informational: the silver and experience are already paid when the row is
written.**

## Push notifications

`integrations/notification/notification.service.ts` is a thin facade over
OneSignal so nothing else depends on the provider. It can target a user, or a
**tag** — `sendPushNotificationToTag({ tagKey: 'guild', tagValue: guildId })` is
how the whole guild is told a boss was summoned or killed.

## Discord bot

Two gateways:

- `discord.gateway.ts` — player-facing: `create_discord_register_token` produces
  a token the player pastes to the bot; `get_profile`.
- `discordBot.gateway.ts` — **bot-only**, behind `WebsocketDiscordServiceGuard`.

The bot mirrors most of the game (59 events: profile, inventory, equipment,
battle, maps, guild, market, party, mail, skills, professions), and each event
**names the acting `discordId` in its payload** rather than reading the socket.
That is the whole reason the guard exists: without it a player socket could read
and mutate any linked account.

The bot's socket authenticates with the reserved email `discord`
(`DISCORD_SERVICE_EMAIL`), and battles push `battle_update` to that email too so
the bot can render a fight.

`utilities/imageDrawer.ts` renders battle images (node-canvas) for the bot.

## Purchases

`src/feature/purchase` + `integrations/revenuecat`.

**The only HTTP endpoint that does game work** is the RevenueCat webhook,
`POST /purchase/webhook` (`purchase.controller.ts`, behind `purchase.guard.ts`).
It handles `NON_RENEWING_PURCHASE` → register, and `CANCELLATION` → cancel.
Everything else HTTP serves is static pages and `/version`.

Flow: webhook writes a `UserPurchase` (`received: false`) → the client sees it
via `get_purchases` / the `purchases` push → `claim_purchase` grants the
`StoreProduct`'s silver and item, by mail. `refund_purchase` asks RevenueCat and
marks the row.

## Admin

`src/feature/admin`, behind `AdminGuard` (the `User.admin` column).

Live-operations tools: connected sockets, server info and restart, cache
clearing (all or one user), push notifications, gift mail, silver grants,
full-heal and kill, `force_end_battle` (for a fight stuck in the in-memory list),
and three daily-reset escapes — `reset_daily_stamina`, `reset_boss_entry`,
`clear_guild_bosses`.

`force_end_battle` exists because battles are in memory: before wipes set
`battleFinished`, a lost fight would sit in `battleList` until an admin cleared
it.
