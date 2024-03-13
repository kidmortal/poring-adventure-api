-- AlterTable
ALTER TABLE "Item" ADD COLUMN "agi" INTEGER;
ALTER TABLE "Item" ADD COLUMN "int" INTEGER;
ALTER TABLE "Item" ADD COLUMN "mana" INTEGER;
ALTER TABLE "Item" ADD COLUMN "str" INTEGER;

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Profession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "health" INTEGER NOT NULL DEFAULT 1,
    "mana" INTEGER NOT NULL DEFAULT 1,
    "str" INTEGER NOT NULL DEFAULT 1,
    "agi" INTEGER NOT NULL DEFAULT 1,
    "int" INTEGER NOT NULL DEFAULT 1
);
INSERT INTO "new_Profession" ("id", "name") SELECT "id", "name" FROM "Profession";
DROP TABLE "Profession";
ALTER TABLE "new_Profession" RENAME TO "Profession";
CREATE TABLE "new_Stats" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "experience" INTEGER NOT NULL DEFAULT 1,
    "health" INTEGER NOT NULL DEFAULT 20,
    "maxHealth" INTEGER NOT NULL DEFAULT 20,
    "mana" INTEGER NOT NULL DEFAULT 20,
    "maxMana" INTEGER NOT NULL DEFAULT 20,
    "attack" INTEGER NOT NULL DEFAULT 1,
    "str" INTEGER NOT NULL DEFAULT 1,
    "agi" INTEGER NOT NULL DEFAULT 1,
    "int" INTEGER NOT NULL DEFAULT 1,
    "userEmail" TEXT NOT NULL,
    CONSTRAINT "Stats_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Stats" ("agi", "attack", "experience", "health", "id", "int", "level", "maxHealth", "str", "userEmail") SELECT "agi", "attack", "experience", "health", "id", "int", "level", "maxHealth", "str", "userEmail" FROM "Stats";
DROP TABLE "Stats";
ALTER TABLE "new_Stats" RENAME TO "Stats";
CREATE UNIQUE INDEX "Stats_userEmail_key" ON "Stats"("userEmail");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
