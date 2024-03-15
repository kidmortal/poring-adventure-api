-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Profession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "costume" TEXT NOT NULL DEFAULT 'none',
    "attack" INTEGER NOT NULL DEFAULT 1,
    "health" INTEGER NOT NULL DEFAULT 1,
    "mana" INTEGER NOT NULL DEFAULT 1,
    "str" INTEGER NOT NULL DEFAULT 1,
    "agi" INTEGER NOT NULL DEFAULT 1,
    "int" INTEGER NOT NULL DEFAULT 1
);
INSERT INTO "new_Profession" ("agi", "costume", "health", "id", "int", "mana", "name", "str") SELECT "agi", "costume", "health", "id", "int", "mana", "name", "str" FROM "Profession";
DROP TABLE "Profession";
ALTER TABLE "new_Profession" RENAME TO "Profession";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
