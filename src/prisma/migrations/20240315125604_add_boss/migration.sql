-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Monster" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "boss" BOOLEAN NOT NULL DEFAULT false,
    "attack" INTEGER NOT NULL DEFAULT 1,
    "health" INTEGER NOT NULL DEFAULT 1,
    "silver" INTEGER NOT NULL DEFAULT 1,
    "exp" INTEGER NOT NULL DEFAULT 1
);
INSERT INTO "new_Monster" ("attack", "exp", "health", "id", "image", "name", "silver") SELECT "attack", "exp", "health", "id", "image", "name", "silver" FROM "Monster";
DROP TABLE "Monster";
ALTER TABLE "new_Monster" RENAME TO "Monster";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
