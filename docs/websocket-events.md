# Websocket event reference

The complete wire contract between the API and the client. Socket.IO, one
connection per player, no REST.

Two directions:

- **Inbound** — `@SubscribeMessage` handlers. The client emits and usually
  awaits the acknowledgement (`asyncEmit` on the client side, 15s timeout).
- **Outbound** — server pushes, via `WebsocketService`. The client registers
  these in the client repo's `src/layout/Websocket/listeners.ts` and
  `toastListener.tsx`.

**Most mutations return a bare `boolean` and do the real work by pushing.** A
refusal is normally `error_notification` + `false`, not a thrown exception.

## Outbound (server → client)

| Event | Payload | Meaning |
|---|---|---|
| `authenticated` | `{}` | Handshake accepted; sent once on connect. |
| `user_update` | `FullUser` | The caller's whole profile — stats, inventory, class, skills, buffs, professions. Pushed after anything that changes them. |
| `battle_update` | `Battle` or `undefined` | The fight, re-serialised after every action. **`undefined` means the battle is over and gone.** |
| `party_data` | `Party` | Membership. |
| `party_status` | `{ chat, isPartyOpen }` | The in-memory half of a party. |
| `party_invite` | `Party` | Rendered as an accept/refuse toast. |
| `guild` | `Guild` | The guild with members, task, applications, blessing. |
| `guild_boss` | `CurrentGuildBoss` or `false` | `false` means no boss standing. |
| `dungeon_status` | `{ run, entries }` | The active run and every entry the caller's **party** holds. |
| `mailbox` | `Mail[]` | |
| `notifications` | `Notification[]` | |
| `purchases` | `UserPurchase[]` | |
| `connected_users` | `{ id, email }[]` | Admin panel. |
| `server_info` | server stats | Admin panel. |
| `notification` | `string` | Info toast. |
| `error_notification` | `string` | Error toast — the standard refusal channel. |

**`market_update` is listened for by the client but nothing here emits it.** The
market page refreshes by invalidating its own query instead. Either wire it up
or delete the listener; do not assume it works.

## Inbound, by gateway

### `users.gateway.ts`
`get_user` · `get_all_user` · `create_user` · `update_user_name` · `delete_user` ·
`get_all_classes` · `get_all_heads`

`get_user` is also where a new day's stamina is granted — reading the profile is
the trigger.

### `battle.gateway.ts`
`battle_create` (`{ mapId }`) · `battle_create_guild_boss` ·
`battle_create_dungeon` (`{ dungeonId }`) · `battle_dungeon_continue` ·
`battle_update` · `battle_reset` · `battle_attack` ·
`battle_use_item` (`{ inventoryId }`) · `battle_cast` (`{ skillId, targetName? }`)

The two dungeon events live here rather than on the dungeon gateway because they
open a battle, and the battle list belongs to `BattleService`.

### `monsters.gateway.ts`
`get_maps` · `get_monster_from_map`

### `dungeon.gateway.ts`
`get_dungeons` · `get_dungeon_status` · `dungeon_abandon`

### `items.gateway.ts`
`consume_item` · `equip_item` · `unequip_item` · `enhance_item` · `upgrade_item`

### `market.gateway.ts`
`get_all_market_listing` · `create_market_listing` · `purchase_market_listing` ·
`remove_market_listing`

### `profession.gateway.ts`
`get_all_professions` · `get_user_professions` · `learn_profession` ·
`get_gathering_nodes` · `gather` · `get_recipes` · `craft` · `get_commissions` ·
`deliver_commission` · `get_service_offers` · `get_user_service_offer` ·
`publish_service_offer` · `remove_service_offer` · `hire_craft` ·
`hire_enhance` · `self_assisted_enhance`

### `skills.gateway.ts`
`learn_skill` · `equip_skill` · `unequip_skill`

### `party.gateway.ts`
`create_party` · `remove_party` · `get_party` · `get_open_parties` ·
`open_party` · `close_party` · `invite_to_party` · `join_party` · `quit_party` ·
`kick_from_party` · `promote_party_member` · `send_party_chat_message`

### `guild.gateway.ts`
`get_guild` · `find_all_guild` · `apply_to_guild` · `accept_guild_application` ·
`refuse_guild_application` · `kick_from_guild` · `quit_from_guild` ·
`get_available_guild_tasks` · `accept_guild_task` · `cancel_guild_task` ·
`finish_current_task` · `get_guild_bosses` · `get_guild_boss` ·
`summon_guild_boss` · `dismiss_guild_boss` · `get_guild_store` ·
`buy_guild_store_product` · `unlock_blessing` · `upgrade_blessing`

### `mail.gateway.ts`
`get_all_mail` · `claim_all_mail` · `view_all_mail` · `delete_all_mail` ·
`send_gift` · `get_all_notifications` · `read_all_notifications` ·
`delete_all_notifications`

### `purchase.gateway.ts`
`get_purchases` · `claim_purchase` · `refund_purchase`

### `discord.gateway.ts` (player-facing)
`create_discord_register_token` · `get_profile`

### `discordBot.gateway.ts` (bot only)
Behind `WebsocketDiscordServiceGuard`. 59 events, all prefixed `discord_` plus
`register_discord_profile`, `get_discord_battle`, `get_discord_user`,
`get_discord_user_inventory`. Each names the acting `discordId` in its payload
rather than reading the socket, which is exactly why the guard exists. They
mirror the player events: profile, inventory, equipment, battle, maps, guild,
market, party, mail, skills, professions.

### `admin.gateway.ts`
Behind `AdminGuard`. `get_all_connected_users` · `get_server_info` ·
`restart_server` · `message_socket` · `disconnect_user_websocket` ·
`clear_all_cache` · `clear_user_cache` · `send_push_notification` ·
`send_push_notification_user` · `send_gift_mail` · `give_silver` ·
`full_heal_user` · `kill_user` · `force_end_battle` · `kill_battle_monsters` ·
`battle_debug_action` · `resync_levels` ·
`reset_daily_stamina` ·
`reset_boss_entry` · `clear_guild_bosses`

## Adding an event

1. DTO as a global `declare type` in `src/types/dto/<feature>.d.ts`.
2. Handler on the feature gateway — read `client.handshake.auth.email`, log,
   delegate. No logic.
3. Client method in `src/api/services/<feature>Service.ts`, exposed through
   `useWebsocketApi()`.
4. If it pushes a new event, register the listener in the client's
   `src/layout/Websocket/listeners.ts`.
5. Add it to this file.
