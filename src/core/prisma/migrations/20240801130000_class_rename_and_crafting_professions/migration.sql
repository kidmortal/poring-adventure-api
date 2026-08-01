-- Professions are now the crafting and gathering trades, so the combat
-- archetype moves out of that table into "Class" — the name it always meant.
-- The old Profession rows (Rune Knight, Priest, ...) become Class rows, and
-- Profession is rebuilt empty for the trades.

-- CreateTable
CREATE TABLE "Class" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '❔',
    "description" TEXT NOT NULL DEFAULT '',
    "costume" TEXT NOT NULL DEFAULT 'none',
    "attack" INTEGER NOT NULL DEFAULT 1,
    "health" INTEGER NOT NULL DEFAULT 1,
    "mana" INTEGER NOT NULL DEFAULT 1,
    "str" INTEGER NOT NULL DEFAULT 1,
    "agi" INTEGER NOT NULL DEFAULT 1,
    "int" INTEGER NOT NULL DEFAULT 1
);

-- Every existing archetype keeps its id, so User.professionId and
-- Skill.professionId stay valid when they are copied over as classId.
INSERT INTO "Class" ("id", "name", "icon", "description", "costume", "attack", "health", "mana", "str", "agi", "int")
SELECT "id", "name", "icon", "description", "costume", "attack", "health", "mana", "str", "agi", "int" FROM "Profession";

-- The progression rows written while Profession meant "class" tracked
-- something that no longer levels on its own.
DELETE FROM "UserProfession";

-- CreateTable
CREATE TABLE "GatheringNode" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "image" TEXT NOT NULL DEFAULT '',
    "professionId" INTEGER NOT NULL,
    "requiredLevel" INTEGER NOT NULL DEFAULT 1,
    "staminaCost" INTEGER NOT NULL DEFAULT 5,
    "experience" INTEGER NOT NULL DEFAULT 10,
    CONSTRAINT "GatheringNode_professionId_fkey" FOREIGN KEY ("professionId") REFERENCES "Profession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GatheringDrop" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chance" INTEGER NOT NULL,
    "minAmount" INTEGER NOT NULL DEFAULT 1,
    "maxAmount" INTEGER NOT NULL DEFAULT 1,
    "nodeId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    CONSTRAINT "GatheringDrop_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "GatheringNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GatheringDrop_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "professionId" INTEGER NOT NULL,
    "requiredLevel" INTEGER NOT NULL DEFAULT 1,
    "staminaCost" INTEGER NOT NULL DEFAULT 5,
    "experience" INTEGER NOT NULL DEFAULT 10,
    "itemId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "Recipe_professionId_fkey" FOREIGN KEY ("professionId") REFERENCES "Profession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Recipe_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "recipeId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecipeIngredient_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "silver" INTEGER NOT NULL DEFAULT 20,
    "admin" BOOLEAN NOT NULL DEFAULT false,
    "classId" INTEGER,
    "partyId" INTEGER,
    CONSTRAINT "User_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("admin", "email", "id", "name", "partyId", "silver", "classId") SELECT "admin", "email", "id", "name", "partyId", "silver", "professionId" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE TABLE "new_Skill" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "requiredLevel" INTEGER NOT NULL DEFAULT 1,
    "manaCost" INTEGER NOT NULL DEFAULT 1,
    "cooldown" INTEGER NOT NULL DEFAULT 1,
    "category" TEXT NOT NULL DEFAULT 'target_enemy',
    "effect" TEXT,
    "name" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT 'Skill Description',
    "attribute" TEXT NOT NULL,
    "multiplier" INTEGER NOT NULL DEFAULT 1,
    "classId" INTEGER NOT NULL,
    "buffId" INTEGER,
    CONSTRAINT "Skill_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Skill_buffId_fkey" FOREIGN KEY ("buffId") REFERENCES "Buff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Skill" ("attribute", "buffId", "category", "cooldown", "description", "effect", "id", "image", "manaCost", "multiplier", "name", "requiredLevel", "classId") SELECT "attribute", "buffId", "category", "cooldown", "description", "effect", "id", "image", "manaCost", "multiplier", "name", "requiredLevel", "professionId" FROM "Skill";
DROP TABLE "Skill";
ALTER TABLE "new_Skill" RENAME TO "Skill";
CREATE TABLE "new_Profession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '❔',
    "description" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'gathering'
);
DROP TABLE "Profession";
ALTER TABLE "new_Profession" RENAME TO "Profession";
CREATE UNIQUE INDEX "Profession_name_key" ON "Profession"("name");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE UNIQUE INDEX "Class_name_key" ON "Class"("name");

-- CreateIndex
CREATE UNIQUE INDEX "GatheringNode_name_key" ON "GatheringNode"("name");

-- CreateIndex
CREATE UNIQUE INDEX "GatheringDrop_nodeId_itemId_key" ON "GatheringDrop"("nodeId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_name_key" ON "Recipe"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeIngredient_recipeId_itemId_key" ON "RecipeIngredient"("recipeId", "itemId");
