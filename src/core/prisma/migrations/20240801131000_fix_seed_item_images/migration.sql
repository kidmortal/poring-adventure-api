-- The crafting seed pointed every new item at a `/items/` folder that does not
-- exist on the CDN. The real layout is one folder per category:
-- `/materials/`, `/equipments/`, `/consumables/` — as the rest of the catalog
-- already uses. Fixing it here instead of in the seed keeps the applied
-- migration's checksum intact and repairs databases that already ran it.

UPDATE "Item" SET "image" = 'https://kidmortal.sirv.com/materials/copper_ore.webp' WHERE "name" = 'Copper Ore';
UPDATE "Item" SET "image" = 'https://kidmortal.sirv.com/materials/iron_ore.webp' WHERE "name" = 'Iron Ore';
UPDATE "Item" SET "image" = 'https://kidmortal.sirv.com/materials/raw_fish.webp' WHERE "name" = 'Raw Fish';
UPDATE "Item" SET "image" = 'https://kidmortal.sirv.com/materials/fish_scale.webp' WHERE "name" = 'Fish Scale';
UPDATE "Item" SET "image" = 'https://kidmortal.sirv.com/materials/green_herb.webp' WHERE "name" = 'Green Herb';
UPDATE "Item" SET "image" = 'https://kidmortal.sirv.com/materials/blue_herb.webp' WHERE "name" = 'Blue Herb';

UPDATE "Item" SET "image" = 'https://kidmortal.sirv.com/equipments/copper_dagger.webp' WHERE "name" = 'Copper Dagger';
UPDATE "Item" SET "image" = 'https://kidmortal.sirv.com/equipments/iron_sword.webp' WHERE "name" = 'Iron Sword';

UPDATE "Item" SET "image" = 'https://kidmortal.sirv.com/consumables/grilled_fish.webp' WHERE "name" = 'Grilled Fish';
UPDATE "Item" SET "image" = 'https://kidmortal.sirv.com/consumables/healing_potion.webp' WHERE "name" = 'Healing Potion';
UPDATE "Item" SET "image" = 'https://kidmortal.sirv.com/consumables/mana_potion.webp' WHERE "name" = 'Mana Potion';
