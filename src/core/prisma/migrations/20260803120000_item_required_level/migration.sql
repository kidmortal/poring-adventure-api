-- Equipment is tiered from level 1 to 50, so an item now carries the character
-- level needed to wear it. Everything that already exists keeps the default of
-- 1, which is what a consumable or a material means by it anyway.

ALTER TABLE "Item" ADD COLUMN "requiredLevel" INTEGER NOT NULL DEFAULT 1;
