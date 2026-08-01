-- Starting content for the trades: three gathering professions that fill the
-- inventory and three crafting ones that consume it. Everything is looked up by
-- name so the file stays idempotent-ish and works on a database whose ids do
-- not match the development one.

-- Professions
INSERT INTO "Profession" ("name", "icon", "description", "kind") VALUES
  ('Mining', '⛏️', 'Break ore out of veins. Feeds the blacksmith.', 'gathering'),
  ('Fishing', '🎣', 'Pull fish out of any water you can reach. Feeds the cook.', 'gathering'),
  ('Herbalism', '🌿', 'Pick herbs in the wild. Feeds the alchemist.', 'gathering'),
  ('Blacksmithing', '🔨', 'Turn ore into weapons and armor.', 'crafting'),
  ('Cooking', '🍳', 'Turn raw food into meals that restore health.', 'crafting'),
  ('Alchemy', '⚗️', 'Brew herbs into potions.', 'crafting');

-- Materials and craft results. Item names are not unique in the schema, so each
-- insert is guarded to avoid duplicating an item that already exists.
INSERT INTO "Item" ("name", "category", "image")
SELECT 'Copper Ore', 'material', 'https://kidmortal.sirv.com/items/copper_ore.webp'
WHERE NOT EXISTS (SELECT 1 FROM "Item" WHERE "name" = 'Copper Ore');
INSERT INTO "Item" ("name", "category", "image")
SELECT 'Iron Ore', 'material', 'https://kidmortal.sirv.com/items/iron_ore.webp'
WHERE NOT EXISTS (SELECT 1 FROM "Item" WHERE "name" = 'Iron Ore');
INSERT INTO "Item" ("name", "category", "image")
SELECT 'Raw Fish', 'material', 'https://kidmortal.sirv.com/items/raw_fish.webp'
WHERE NOT EXISTS (SELECT 1 FROM "Item" WHERE "name" = 'Raw Fish');
INSERT INTO "Item" ("name", "category", "image")
SELECT 'Fish Scale', 'material', 'https://kidmortal.sirv.com/items/fish_scale.webp'
WHERE NOT EXISTS (SELECT 1 FROM "Item" WHERE "name" = 'Fish Scale');
INSERT INTO "Item" ("name", "category", "image")
SELECT 'Green Herb', 'material', 'https://kidmortal.sirv.com/items/green_herb.webp'
WHERE NOT EXISTS (SELECT 1 FROM "Item" WHERE "name" = 'Green Herb');
INSERT INTO "Item" ("name", "category", "image")
SELECT 'Blue Herb', 'material', 'https://kidmortal.sirv.com/items/blue_herb.webp'
WHERE NOT EXISTS (SELECT 1 FROM "Item" WHERE "name" = 'Blue Herb');

INSERT INTO "Item" ("name", "category", "image", "attack")
SELECT 'Copper Dagger', 'equipment', 'https://kidmortal.sirv.com/items/copper_dagger.webp', 3
WHERE NOT EXISTS (SELECT 1 FROM "Item" WHERE "name" = 'Copper Dagger');
INSERT INTO "Item" ("name", "category", "image", "attack", "str")
SELECT 'Iron Sword', 'equipment', 'https://kidmortal.sirv.com/items/iron_sword.webp', 6, 2
WHERE NOT EXISTS (SELECT 1 FROM "Item" WHERE "name" = 'Iron Sword');
INSERT INTO "Item" ("name", "category", "image", "health")
SELECT 'Grilled Fish', 'consumable', 'https://kidmortal.sirv.com/items/grilled_fish.webp', 30
WHERE NOT EXISTS (SELECT 1 FROM "Item" WHERE "name" = 'Grilled Fish');
INSERT INTO "Item" ("name", "category", "image", "health")
SELECT 'Healing Potion', 'consumable', 'https://kidmortal.sirv.com/items/healing_potion.webp', 50
WHERE NOT EXISTS (SELECT 1 FROM "Item" WHERE "name" = 'Healing Potion');
INSERT INTO "Item" ("name", "category", "image", "mana")
SELECT 'Mana Potion', 'consumable', 'https://kidmortal.sirv.com/items/mana_potion.webp', 50
WHERE NOT EXISTS (SELECT 1 FROM "Item" WHERE "name" = 'Mana Potion');

-- Gathering nodes
INSERT INTO "GatheringNode" ("name", "image", "professionId", "requiredLevel", "staminaCost", "experience")
SELECT 'Copper Vein', 'https://kidmortal.sirv.com/gathering/copper_vein.webp', "id", 1, 5, 10 FROM "Profession" WHERE "name" = 'Mining';
INSERT INTO "GatheringNode" ("name", "image", "professionId", "requiredLevel", "staminaCost", "experience")
SELECT 'Iron Vein', 'https://kidmortal.sirv.com/gathering/iron_vein.webp', "id", 3, 8, 25 FROM "Profession" WHERE "name" = 'Mining';
INSERT INTO "GatheringNode" ("name", "image", "professionId", "requiredLevel", "staminaCost", "experience")
SELECT 'Calm River', 'https://kidmortal.sirv.com/gathering/calm_river.webp', "id", 1, 5, 10 FROM "Profession" WHERE "name" = 'Fishing';
INSERT INTO "GatheringNode" ("name", "image", "professionId", "requiredLevel", "staminaCost", "experience")
SELECT 'Flower Field', 'https://kidmortal.sirv.com/gathering/flower_field.webp', "id", 1, 5, 10 FROM "Profession" WHERE "name" = 'Herbalism';

INSERT INTO "GatheringDrop" ("nodeId", "itemId", "chance", "minAmount", "maxAmount")
SELECT n."id", i."id", 90, 1, 3 FROM "GatheringNode" n, "Item" i WHERE n."name" = 'Copper Vein' AND i."name" = 'Copper Ore';
INSERT INTO "GatheringDrop" ("nodeId", "itemId", "chance", "minAmount", "maxAmount")
SELECT n."id", i."id", 20, 1, 1 FROM "GatheringNode" n, "Item" i WHERE n."name" = 'Copper Vein' AND i."name" = 'Iron Ore';
INSERT INTO "GatheringDrop" ("nodeId", "itemId", "chance", "minAmount", "maxAmount")
SELECT n."id", i."id", 85, 1, 3 FROM "GatheringNode" n, "Item" i WHERE n."name" = 'Iron Vein' AND i."name" = 'Iron Ore';
INSERT INTO "GatheringDrop" ("nodeId", "itemId", "chance", "minAmount", "maxAmount")
SELECT n."id", i."id", 40, 1, 2 FROM "GatheringNode" n, "Item" i WHERE n."name" = 'Iron Vein' AND i."name" = 'Copper Ore';
INSERT INTO "GatheringDrop" ("nodeId", "itemId", "chance", "minAmount", "maxAmount")
SELECT n."id", i."id", 80, 1, 2 FROM "GatheringNode" n, "Item" i WHERE n."name" = 'Calm River' AND i."name" = 'Raw Fish';
INSERT INTO "GatheringDrop" ("nodeId", "itemId", "chance", "minAmount", "maxAmount")
SELECT n."id", i."id", 40, 1, 2 FROM "GatheringNode" n, "Item" i WHERE n."name" = 'Calm River' AND i."name" = 'Fish Scale';
INSERT INTO "GatheringDrop" ("nodeId", "itemId", "chance", "minAmount", "maxAmount")
SELECT n."id", i."id", 85, 1, 3 FROM "GatheringNode" n, "Item" i WHERE n."name" = 'Flower Field' AND i."name" = 'Green Herb';
INSERT INTO "GatheringDrop" ("nodeId", "itemId", "chance", "minAmount", "maxAmount")
SELECT n."id", i."id", 25, 1, 1 FROM "GatheringNode" n, "Item" i WHERE n."name" = 'Flower Field' AND i."name" = 'Blue Herb';

-- Recipes
INSERT INTO "Recipe" ("name", "professionId", "requiredLevel", "staminaCost", "experience", "itemId", "amount")
SELECT 'Copper Dagger', p."id", 1, 5, 15, i."id", 1 FROM "Profession" p, "Item" i WHERE p."name" = 'Blacksmithing' AND i."name" = 'Copper Dagger';
INSERT INTO "Recipe" ("name", "professionId", "requiredLevel", "staminaCost", "experience", "itemId", "amount")
SELECT 'Iron Sword', p."id", 3, 10, 40, i."id", 1 FROM "Profession" p, "Item" i WHERE p."name" = 'Blacksmithing' AND i."name" = 'Iron Sword';
INSERT INTO "Recipe" ("name", "professionId", "requiredLevel", "staminaCost", "experience", "itemId", "amount")
SELECT 'Grilled Fish', p."id", 1, 5, 15, i."id", 1 FROM "Profession" p, "Item" i WHERE p."name" = 'Cooking' AND i."name" = 'Grilled Fish';
INSERT INTO "Recipe" ("name", "professionId", "requiredLevel", "staminaCost", "experience", "itemId", "amount")
SELECT 'Healing Potion', p."id", 1, 5, 15, i."id", 1 FROM "Profession" p, "Item" i WHERE p."name" = 'Alchemy' AND i."name" = 'Healing Potion';
INSERT INTO "Recipe" ("name", "professionId", "requiredLevel", "staminaCost", "experience", "itemId", "amount")
SELECT 'Mana Potion', p."id", 2, 5, 20, i."id", 1 FROM "Profession" p, "Item" i WHERE p."name" = 'Alchemy' AND i."name" = 'Mana Potion';

INSERT INTO "RecipeIngredient" ("recipeId", "itemId", "amount")
SELECT r."id", i."id", 3 FROM "Recipe" r, "Item" i WHERE r."name" = 'Copper Dagger' AND i."name" = 'Copper Ore';
INSERT INTO "RecipeIngredient" ("recipeId", "itemId", "amount")
SELECT r."id", i."id", 4 FROM "Recipe" r, "Item" i WHERE r."name" = 'Iron Sword' AND i."name" = 'Iron Ore';
INSERT INTO "RecipeIngredient" ("recipeId", "itemId", "amount")
SELECT r."id", i."id", 1 FROM "Recipe" r, "Item" i WHERE r."name" = 'Iron Sword' AND i."name" = 'Copper Ore';
INSERT INTO "RecipeIngredient" ("recipeId", "itemId", "amount")
SELECT r."id", i."id", 2 FROM "Recipe" r, "Item" i WHERE r."name" = 'Grilled Fish' AND i."name" = 'Raw Fish';
INSERT INTO "RecipeIngredient" ("recipeId", "itemId", "amount")
SELECT r."id", i."id", 2 FROM "Recipe" r, "Item" i WHERE r."name" = 'Healing Potion' AND i."name" = 'Green Herb';
INSERT INTO "RecipeIngredient" ("recipeId", "itemId", "amount")
SELECT r."id", i."id", 2 FROM "Recipe" r, "Item" i WHERE r."name" = 'Mana Potion' AND i."name" = 'Blue Herb';
