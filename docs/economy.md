# Economy

Items, the market, and the six trades. Design rationale — what was broken and
why each number was chosen — is in `plan.md` at the repo root. This is what is
built.

The shape of it: **combat supplies materials, trades turn them into goods, and
stamina caps the whole supply side.** A fighter farms materials they have no
profession to use and sells them to a crafter who cannot farm them. That loop is
the reason the player market has people in it.

## Items

`feature/items` — `items.service.ts` (consume, enhance, upgrade),
`inventory.service.ts`, `equipment.service.ts`, `items.rules.ts` (pure).

Categories: `weapon`, `armor`, `legs`, `boots`, `accessory` (equippable, listed
in `entities/categories.ts`), plus `consumable` and `material`. Equipping swaps
by category, so one piece per category is worn at a time. `accessory` is the
slot every class shops the same list for: four lines per tier — crit, mana,
health, defense — and the only source of `critRate` / `critDamage` in the
catalog. The top three tiers carry a second version of each line that drops only
in that band's dungeon, worth about twice its map counterpart at the same
required level.

### Quality and enhancement

Two independent axes, both on `InventoryItem`:

- **Quality 1–5** — set when crafted, from the crafter's level, and raised after
  the fact by `upgradeItem` (below). `Utils.qualityMultiplier` =
  `1 + (quality − 1) × 0.15`, so Legendary is +60%.
- **Enhancement +0..+N** — bought at the forge, and the only real silver sink.
  `enhanceChance` starts at 100% and drops 10% of the remainder per level.

Combined: `itemStatsMultiplier(q, e) = qualityMultiplier(q) + e × 0.2 × (q × 0.5)`.
**Quality has to stand on its own in that first term** — it used to be folded
into the enhancement term, which meant a Legendary sword at +0 was numerically
identical to a Common one and a crafter's level bought the buyer nothing.

The item's **level does not appear in that formula and must not**: gear is
seeded one tier per map band with base stats already multiplied by the tier
(`8 × tier` attack and so on), so `requiredLevel` is in the numbers before the
multiplier ever reads them. A level term here would charge for it twice.

`itemStatBlock` is used on **both** equip and unequip so the two can never
disagree and leak stats.

**Price, though, does read all three** (`enhancePrice`, in `items.rules.ts`):
the old 100-silver-and-half-again-per-level curve, times `1 + (level − 1) × 0.1`
and `1 + (quality − 1) × 0.5`. It used to be the enhancement level alone, which
priced a +10 on a level-1 Common shirt exactly like a +10 on a Legendary level-50
blade — while the formula above makes an enhancement level worth **five times**
as much on a Legendary as on a Common. The cheapest power in the game was on the
same shelf as the most expensive.

Failure setback (`profession.rules`): below **+6** a failure costs only silver;
from +6 up it costs a level, never below the **+5 floor**. That is what keeps a
blacksmith in business — high enhancement becomes a standing relationship rather
than an errand.

### Raising rarity — the gear sink

`upgradeItem` (`items.service.ts`) feeds a **duplicate into the item** for a
chance at the next quality tier. The material must be the same item at the same
quality; its own enhancement is **not read at all**, which is the point — this is
where the fourth copy of a tier-2 helmet goes, so the drop table stops being
noise and becomes the supply line for rarity.

| Gate | Why |
|---|---|
| Target at **+5 or better** (`UPGRADE_MIN_ENHANCEMENT`) | Makes it a decision taken after a run of enhancement, not the first thing done with a fresh drop |
| Target below Legendary | Nowhere left to go |
| Material unlocked, unequipped, not promised to a market listing | The obvious ways to lose something you meant to keep |
| Material auto-picked **least enhanced first** | Feeding a +7 into a +5 is never what anyone meant |

Odds by the quality being **left**: 70% → Uncommon, 50% → Rare, 30% → Epic,
10% → Legendary (`upgradeChance`).

**Both outcomes cost the same**: the duplicate is gone and the enhancement is
reset to **+0**. Losing the +5 is the real price of the roll — the silver already
spent reaching it is what is being gambled, and it is why the odds are generous
at the bottom and cruel at the top. Note this is the one path that resets past
the `SETBACK_FLOOR`; the floor guards a failed *forge* attempt, not a chosen one.

One consequence worth knowing: since price scales on quality, a successful
upgrade makes every subsequent enhancement on that item more expensive.

### Consumables

- `consumablePotency` scales healing by **quality** but never enhancement.
- `buffDurationForQuality` — a better cook makes a meal that **lasts longer**,
  not a stronger one. Chosen because it stays easy to reason about when meals
  stack.
- `battleUse` gates drinking mid-fight (Alchemy's niche — food is deliberately
  excluded); `partyWide` feeds the whole party; `battleEffect: 'escape'` retreats
  from a fight and bypasses the party-leader rule.

## Market

`feature/market`. Direct player-to-player listings, broadcast to everyone via
`market_update`.

`market.rules.ts` holds the two silver sinks:

| | Rate | Who pays |
|---|---|---|
| `LISTING_FEE_RATE` | 2% of asking value | Seller, up front, **never refunded** |
| `SALE_TAX_RATE` | 5% of the sale | Burned out of the seller's payout |

The buyer always pays the full asking price, so a listing's price means what it
says on the board. The fee is non-refundable on purpose: it makes a wall of
speculative listings, or a re-list every ten minutes, cost something.

## The six trades

`feature/profession`. Three gathering (Mining, Fishing, Herbalism) and three
crafting (Blacksmithing, Cooking, Alchemy). A player levels each learned trade
independently (`UserProfession`).

**Professions are not classes.** They have nothing to do with combat, are
learned on top of the class, and every action they offer costs stamina.

### Gathering — `gathering.service.ts`

Pay a node's stamina cost, and **every drop on its table is rolled once,
independently** (`rollNodeDrops`) — a lucky gather returns the whole table, an
unlucky one nothing.

### Crafting — `crafting.service.ts`

Ingredients plus stamina in, one item out. **Crafting never fails** —
`requiredLevel` is the gate, not a roll. `planIngredientConsumption` matches
ingredients by item id across *every* stack the player owns, because the same
material sits in several stacks at different qualities, and it never touches
equipped or listed items. Quality is rolled from `craftQualityChances` /
`rollCraftQuality`, a curve that is generous by design.

### Hiring — `serviceOffer.service.ts`, `hiring.service.ts`

A crafter publishes one `ServiceOffer`: a price per stamina point, and whether
they take crafting jobs, enhancement jobs, or both (`Profession.canEnhance`
gates enhancement).

- **The hirer brings the materials**; they are paying for the crafter's stamina
  and level, nothing else. `serviceFee = staminaCost × pricePerStamina`.
- The crafter earns `EXPERIENCE_PER_STAMINA = 2` per point spent.
- A hired enhancement costs a flat `ENHANCE_SERVICE_STAMINA_COST = 10`.
- `hiredEnhanceBonus` — each blacksmith level adds 10% of the base chance,
  capped so it can never reach 100%. Worth most where the odds are already
  decent, never turning a hopeless attempt into a sure thing.
- The crafter is paid while offline, and finds a `Notification` row explaining
  what happened.

### Commissions — `commission.service.ts`, `commission.rules.ts`

Standing NPC contracts: hand over N of an item, get paid. **This is the price
floor under every crafted good** — a crafter always has one buyer, even when no
player wants what they make.

The clever bit: **which contracts a player is offered is derived, not stored.**
`pickDailyCommissions` hashes `email + utcDayKey` to shuffle the contracts their
profession and level qualify for and takes `DAILY_COMMISSION_SLOTS = 4`. The
board therefore survives a reload without a write and cannot be re-rolled by
looking again. A `UserCommission` row exists only once goods are handed over,
and its `offeredOn` day is what caps a contract to once a day.

## Where silver comes from and goes

| In | Out |
|---|---|
| Monster kills | Enhancement forge (`enhancePrice`, scaled by item level and rarity) |
| Commissions | Market listing fee (2%) |
| Selling on the market | Market sale tax (5%) |
| | Hiring a crafter (moves between players) |
| | Store purchases (moves between players) |
