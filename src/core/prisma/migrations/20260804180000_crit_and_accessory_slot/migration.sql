-- Critical hits, and the slot that carries them.
--
-- Every character crits 5% of the time for double value, on damage and on
-- healing alike. Both numbers live on Stats so gear can move them the same way
-- it moves attack, and both are also on Buff so a meal or a blessing can raise
-- them for a fight without anything having to be unwound when it expires.
--
-- The accessory slot needs no column of its own: it is another Item.category,
-- and the equip path already swaps by category.
--
-- Existing rows land on the base values, which is the behaviour the game had
-- before this — a 5% chance at double is close enough to nothing that no
-- balance the players already know changes underneath them.

ALTER TABLE "Stats" ADD COLUMN "critRate" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "Stats" ADD COLUMN "critDamage" INTEGER NOT NULL DEFAULT 200;
ALTER TABLE "Item" ADD COLUMN "critRate" INTEGER;
ALTER TABLE "Item" ADD COLUMN "critDamage" INTEGER;
ALTER TABLE "Buff" ADD COLUMN "critRateBonus" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Buff" ADD COLUMN "critDamageBonus" INTEGER NOT NULL DEFAULT 0;
