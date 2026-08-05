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

### Two caches hold membership, and both have to be dropped

`User.partyId` is copied into the cached profile (`user_<email>`), and the
members are copied into the cached party (`party_<id>`). Leaving, being kicked
and disbanding all clear **both** — `_forgetPartyOnUsers` is the profile half.
Skipping it left a member whose cached profile still pointed at a party that had
been deleted, and the next fight they started went looking for it: a null
dereference in `BattleService`, not merely a stale screen.

`_gatherParty` also treats a `partyId` that resolves to nothing as solo rather
than throwing, and drops the offending cache entry on the way past. The player
asked for a fight, and one player is a perfectly good party.

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
`kill_battle_monsters`, and three daily-reset escapes — `reset_daily_stamina`,
`reset_boss_entry`, `clear_guild_bosses`.

`force_end_battle` exists because battles are in memory: before wipes set
`battleFinished`, a lost fight would sit in `battleList` until an admin cleared
it.

`kill_battle_monsters` drops everything standing in a fight — the admin's own
when no email is given — and settles it through `BattleInstance.forceKillMonsters`,
which runs the battle's ordinary victory path. It is a testing tool for what a
kill *leads to*: the drop roll, the experience, a dungeon's next stage, a guild
boss's banked damage. Paying the rewards out directly instead would be
exercising a path the game does not otherwise have.

`battle_debug_action` is the rest of the fight put under the same guard — heal
or wound either side, hand out a buff or a debuff, refill or empty the mana,
pass the turn, add an enrage stack (`BattleDebugAction` lists them). One event
carrying a verb rather than a dozen events, since they differ only in the verb.

**None of them spend a turn.** A fight is a state machine driven by turns, so a
tool that advanced one would change the thing being inspected: each action
mutates the table and pushes, and the order is left where it was. `next_turn` is
the deliberate exception and is named for it.

Two things the engine cannot do, so the tool does not offer them: a monster
carries debuffs and never buffs, and a player carries buffs and never debuffs.
The catalogue rows are read in `AdminService` and handed to the engine, which
has no database of its own — the rule that keeps the fight unit-testable.

The kill is **dealt, not declared** — the monster's remaining health goes
through the same per-player tally a real hit feeds, credited to the admin when
they are in the fight and to a participant when they are not. A guild boss banks
`consumeDamage()`, so zeroing health without touching the tally banked nothing:
the pool stayed full, `applyDamage` returned early on `total <= 0`, and the boss
neither died nor paid out.
