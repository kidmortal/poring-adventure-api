# Crafting economy — diagnosis and plan

A design plan for making the six professions worth playing and worth buying from.
Everything below is measured against what is actually in the repository today, not
against how the systems were meant to feel.

---

## 1. What is already built

More is in place than the current experience suggests. The parts worth keeping:

| System | Where | State |
|---|---|---|
| Six professions, one at a time | `Profession`, `UserProfession` | Mining, Fishing, Herbalism (gathering); Blacksmithing, Cooking, Alchemy (crafting) |
| Stamina as a daily budget | `userStamina.service.ts` | 50/day, refills on first sight of a new UTC day |
| Gathering nodes with roll tables | `gathering.service.ts`, `rollNodeDrops` | Each drop rolled independently |
| Recipes with ingredients | `crafting.service.ts`, `planIngredientConsumption` | Consumes across stacks, never touches equipped or listed items |
| Craft quality 1–5 by crafter level | `craftQualityChances`, `rollCraftQuality` | Well-designed curve, generous on purpose |
| A hiring board | `serviceOffer.service.ts`, `hiring.service.ts` | Crafters sell stamina at a price per point; hirer brings materials |
| Enhancement, with a smith bonus | `hiredEnhanceChance` | Each smith level adds 10% of base chance |
| Player market | `market.service.ts` | Direct listings, buyer to seller |
| Buffs with duration | `Buff`, `UserBuff`, `decreaseUserBuffs` | Ticks down one per battle, already wired into battle rewards |

The bones are good. The economy fails for reasons that are mostly **numbers and
missing sinks**, not missing systems.

---

## 2. Why it does not work today

Seven findings, each verifiable in the code.

### 2.1 Craft quality does nothing — for anyone

```ts
// utils.ts
itemStatsMultiplier(quality, enhancement) = 1 + enhancement * 0.2 * (quality * 0.5)
```

At `enhancement = 0` this is `1` for **every** quality. A Legendary sword at +0 is
numerically identical to a Common one at +0.

Worse for consumables: `consumeItem` never calls `itemStatBlock` at all —

```ts
if (item.health) { incrementUserHealth({ amount: item.health }) }   // raw value
```

So quality is inert for Cooking and Alchemy **permanently**, and inert for
Blacksmithing until the item is enhanced.

This is the single most damaging finding. The entire reason to hire a level-20
crafter instead of a level-1 one — `rollCraftQuality`, a carefully built and
tested system — currently changes nothing a player can feel.

### 2.2 Cooking is strictly dominated by Alchemy

From the seed, both at profession level 1, both 5 stamina, both 2 materials:

| Recipe | Profession | Effect |
|---|---|---|
| Grilled Fish | Cooking | +30 health |
| Healing Potion | Alchemy | +50 health |

Same cost, 67% more output. There is no reason to be a Cook, and therefore no
reason to be a Fisherman. This is the "200 cakes nobody buys" problem in its
literal form — it is in the data, not in the players' heads.

### 2.3 Consumables cannot be used in battle

`grep stamina src/feature/battle/` and `grep consumeItem src/feature/battle/` both
come back empty. Potions and food are **out-of-combat top-ups only**. They compete
with waiting, and a Priest beats them in the one place healing is tense. A
consumable that cannot be used under pressure is a convenience item, and
convenience items do not sustain a profession.

### 2.4 Combat income is uncapped; profession income is capped

Battle consumes **no stamina**. A player can grind monsters indefinitely.

- Level 41–50 map: ~210–235 silver per normal kill, 1000 from the boss, unlimited.
- A crafter: 50 stamina per day, total. Roughly 10 crafts or 10 gathers, then done.

No pricing of crafted goods can close that gap. A profession can never be a
primary income while its budget is a hard daily cap and combat's is not.

### 2.5 There is no silver sink, so silver only accumulates

`market.service.ts` `buyItem` transfers 100% of the price from buyer to seller.
No listing fee, no tax. The only sink in the entire game is the enhancement forge
price (100 at +1, rising to 3,855 at +10) — and that is one profession's niche.

Silver enters from every kill and essentially never leaves. Prices inflate,
and crafted goods — whose supply is bounded by stamina — fall behind.

### 2.6 Demand is one-shot; supply is permanent

Consumables never expire, stack forever, and are freely tradeable. Once one Cook
has made 200 cakes, that demand is satisfied **permanently** for the whole server.
Meanwhile the Cook's stamina refills tomorrow and the day after.

Any economy where supply regenerates daily and demand does not will collapse to
zero price. This is structural, and no amount of price-tuning fixes it.

### 2.7 Materials have no floor

Nothing consumes materials except recipes. No vendor, no turn-in, no quest. If
Grilled Fish is worthless, Raw Fish is worthless, and Fishing pays nothing. The
gathering professions inherit whatever demand the crafting professions have —
which today is none.

**Minor bug found while reading:** `enhanceItem` checks `equipped` but never
checks `category`. A player can pay silver to enhance a Healing Potion, and it has
no effect whatsoever, because `consumeItem` ignores the multiplier. Cheap fix,
worth doing regardless of the rest of this plan.

---

## 3. Design principles

1. **Every profession needs an effect no other profession can produce.** Not a
   better number — a different verb.
2. **Demand must regenerate.** Anything permanent saturates. The good stuff should
   be consumed, expire, or break.
3. **Stamina is the real currency.** It is the only genuinely scarce resource. The
   economy should be denominated in it.
4. **A crafter's level must be visible in what they sell.** Otherwise the hiring
   board is a race to the cheapest, and mastery is pointless.
5. **Silver must leave the game** at roughly the rate it enters.

---

## 4. Give each profession a verb

| Profession | Verb it owns | Why nobody else can do it |
|---|---|---|
| **Cooking** | **Pre-battle buffs** | Timed stat buffs via the existing `Buff`/`UserBuff` system. A Priest buffs *during* a fight and costs a party slot; food is bought in advance and stacks with a Priest. |
| **Alchemy** | **In-combat consumables** | Potions usable during battle at the cost of your turn. A party without a Priest can substitute silver for a heal — worse than a Priest, which is the point. |
| **Blacksmithing** | **Gear quality and enhancement** | Already the strongest. Keep it, and make quality actually multiply. |
| **Mining** | Ore → weapons/armor | Feeds the highest-value crafting line. |
| **Fishing** | Raw food → buff meals | Feeds Cooking, which now has real demand. |
| **Herbalism** | Herbs → potions | Feeds Alchemy. |

### Cooking in detail — the flagship change

Food stops healing and starts buffing. The infrastructure exists: `Buff` has
`duration`, `effect`, `maxStack`, `persist`; `decreaseUserBuffs` already ticks
duration down once per battle in the reward path.

Example line:

| Meal | Level | Effect | Duration |
|---|---|---|---|
| Grilled Fish | 1 | +10% attack | 3 battles |
| Herb Stew | 10 | +15% max health | 3 battles |
| Spiced Roast | 20 | +10% attack, +10% health | 4 battles |
| Feast Platter | 30 | party-wide +10% attack | 3 battles |

The Feast is the interesting one: a Cook becomes something a **party** brings, not
an individual. That is a demand multiplier and a social reason to have one.

Buffs expire → demand regenerates → the 200-cakes problem dissolves. A raid group
running content daily needs food daily, forever.

### Alchemy in detail

- Potions become usable in battle, consuming the caster's turn.
- New utility line that a Priest cannot replicate: **Revive Draught** (self-res
  once per fight), **Antidote** (clears a debuff once debuffs exist), **Escape
  Powder** (leave a fight without the party-leader restriction).
- Keep out-of-combat healing as the cheap tier.

Alchemy is the "insurance" profession — bought in bulk, consumed under pressure,
never enough of it.

---

## 5. Make quality matter (highest priority, smallest change)

Split the multiplier so quality stands on its own:

```ts
// quality 1..5 → 1.00, 1.15, 1.30, 1.45, 1.60
function qualityMultiplier(quality: number) {
  return 1 + (Math.max(quality, 1) - 1) * 0.15;
}

// enhancement keeps its own curve, and quality amplifies it as it does today
function itemStatsMultiplier(quality: number, enhancement: number) {
  return qualityMultiplier(quality) + enhancement * 0.2 * (quality * 0.5);
}
```

And apply it in `consumeItem`, which currently ignores it entirely:

```ts
const potency = Math.floor(item.health * qualityMultiplier(inventoryItem.quality));
```

Effect: a Legendary Healing Potion restores 80 instead of 50. A level-20
alchemist's output is worth visibly more than a level-1's, so the hiring board
becomes a market for **skill** rather than a race to the cheapest stamina.

This one change is what makes `craftQualityChances` — already written, already
tested — start paying for itself.

⚠️ This buffs existing enhanced gear retroactively (a +5 Legendary goes from ×3.5
to ×4.1). Worth a pass over the tier-5 weapon numbers afterwards.

---

## 6. Demand engines

Quality and niches make crafted goods *good*. These make them **repeatedly
needed** — this is the part that actually fixes the economy.

### 6.1 The commission board (strongest single lever)

A rotating set of daily NPC contracts: *"Deliver 10 Healing Potions → 2,400
silver"*. Same shape as `GuildTask`, which already works.

- Creates a **price floor** for every crafted item. A crafter always has a buyer.
- Creates a floor for materials by extension, so gatherers earn.
- Is the **main silver faucet for non-combat players**, closing the gap in §2.4
  without touching combat rewards.
- Rotates daily, so demand regenerates by construction.
- Contracts are per-player and capped, so it cannot be farmed infinitely.

Schema sketch:

```prisma
model Commission {
  id           Int    @id @default(autoincrement())
  itemId       Int
  amount       Int
  silver       Int
  requiredLevel Int   @default(1)
  professionId Int
}
model UserCommission {   // which player took which, and when it resets
  ...
}
```

### 6.2 Enhancement setback

At +6 and above, a failed enhancement drops the item one level instead of merely
wasting silver. Enhancement becomes an ongoing relationship with a blacksmith
rather than a one-time errand, and high-level smiths (better odds) become genuinely
valuable. This is the recurring demand engine for Blacksmithing.

Tune carefully — this is the change most likely to feel punishing. Consider a
protective consumable (an Alchemy product, naturally) that prevents the setback.

### 6.3 Gear durability — *optional, listed for completeness*

Equipment loses durability on defeat and needs a smith to repair. Classic, and it
works, but it taxes losing, which already feels bad. **My recommendation: skip it.**
The commission board and enhancement setback provide enough recurring demand
without punishing failure twice.

---

## 7. Silver sinks and faucets

Current state: faucets everywhere, one sink.

| Change | Type | Notes |
|---|---|---|
| Market sale tax, 5% burned | Sink | Scales automatically with economy size |
| Market listing fee, 2% up front, non-refundable | Sink | Also discourages spam listings and price-fishing |
| Commission board payouts | Faucet | Deliberate: the crafter's income stream |
| Enhancement forge price | Sink | Already exists, already steep |
| Repair costs | Sink | Only if durability is adopted — see above |

A 5% sale tax on a healthy market is the cleanest sink in the game: invisible,
self-scaling, and it never punishes anyone for playing.

---

## 8. Tie professions to the five map bands

The gear refactor established five tiers (levels 1, 11, 21, 31, 41) mapped to five
areas. Professions should ride the same spine:

| Band | Map | New materials | Recipe tier |
|---|---|---|---|
| 1–10 | Poring Forest | Copper Ore, Green Herb, Raw Fish | Profession lv 1 |
| 11–20 | Willow Swamp | Iron Ore, Blue Herb, Swamp Reed | lv 10 |
| 21–30 | Cemetery | Silver Ore, Grave Moss | lv 20 |
| 31–40 | Scorching Desert | Gold Ore, Sun Blossom | lv 30 |
| 41–50 | Demon Sanctuary | Demon Ore, Void Bloom | lv 40 |

Two consequences worth having:

1. **Gathering nodes gated by band** gives gathering a progression curve it
   completely lacks today (currently: two mining nodes, one fishing, one herb).
2. **Monsters drop materials, not just gear.** This is the bridge between the two
   economies: fighters farm mats they cannot use and sell them to crafters who
   cannot fight. That single loop is what makes a player market feel alive.

I would add material drops to the existing monster tables at 20–35% — far higher
than the 5–10% gear rates, because materials are meant to flow.

---

## 9. Staged rollout

Ordered by value per unit of work. Each phase is shippable on its own.

### Phase 1 — Make what exists work (small, high impact)
- Split `itemStatsMultiplier` so quality stands alone (§5).
- Apply quality in `consumeItem`.
- Add the missing `category` check to `enhanceItem`.
- Re-point Cooking's Grilled Fish so it is not strictly worse than a Healing Potion.

*Outcome: crafter level starts mattering. Hiring board becomes meaningful.*

### Phase 2 — Profession identity
- Food grants buffs instead of health; seed the meal line and its `Buff` rows.
- Potions usable in battle, costing a turn.

*Outcome: Cooking and Alchemy stop competing with each other and with Priests.*

### Phase 3 — Recurring demand
- Commission board: schema, rotation, claim flow, UI.
- Material drops on monsters, at 20–35%.

*Outcome: the fisherman-to-cook-to-raider chain closes. Crafting becomes a living.*

### Phase 4 — Sinks and tiering
- Market tax and listing fee.
- Band-tiered materials, nodes and recipes.
- Enhancement setback at +6 and above.

*Outcome: the economy stops inflating and gains a long-term progression curve.*

---

## 10. Numbers to settle before building

These are the tuning decisions I would not guess at:

1. **Is combat meant to stay uncapped?** If a crafter should be able to match a
   grinder's income, commission payouts have to be large — 2,000–3,000 silver a
   day at mid level. If crafting is meant to be a *supplement*, half that. This
   is the single most important number in the plan and it is a taste question.
2. **Should stamina be raisable?** A profession-level bonus to `maxStamina` (say
   +1 per 2 levels) would give crafters a progression that raises their ceiling
   rather than just their quality odds.
3. **Buff duration in battles or in minutes?** Battles is easier — the tick already
   exists in `decreaseUserBuffs` — and is harder to waste while idle.
4. **How punishing should enhancement setback be?** Suggested: only at +6 and up,
   and never below +5, so a player cannot lose a week of work in one click.

---

## 11. What to watch after shipping

- Ratio of listings by category — if crafted goods stay under ~20% of market
  volume, demand engines are still too weak.
- Median silver held per player over time — should flatten once the tax lands.
- How many players have a profession at all, and how many above level 10 — if
  almost nobody is past 10, quality odds are still not worth chasing.
- Commission completion rate — near 100% means they are too easy and are a pure
  faucet; near 0% means the material economy cannot supply them.

---

## Appendix — one-line summary of the diagnosis

Crafting fails not because the systems are missing, but because **craft quality
multiplies by zero, food is strictly worse than potions, consumables cannot be
used when they would matter, silver never leaves the game, and demand is satisfied
permanently while supply refills every morning.** Phase 1 alone fixes the first
two for a few hours of work.
