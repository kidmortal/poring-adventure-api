/*
  Warnings:

  - Added the required column `silver` to the `Monster` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Monster" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "attack" INTEGER NOT NULL,
    "health" INTEGER NOT NULL,
    "silver" INTEGER NOT NULL
);
INSERT INTO "new_Monster" ("attack", "health", "id", "image", "name") SELECT "attack", "health", "id", "image", "name" FROM "Monster";
DROP TABLE "Monster";
ALTER TABLE "new_Monster" RENAME TO "Monster";
CREATE TABLE "new_Drop" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chance" INTEGER NOT NULL,
    "minAmount" INTEGER NOT NULL DEFAULT 1,
    "maxAmount" INTEGER NOT NULL DEFAULT 1,
    "monsterId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    CONSTRAINT "Drop_monsterId_fkey" FOREIGN KEY ("monsterId") REFERENCES "Monster" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Drop_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Drop" ("chance", "id", "itemId", "monsterId") SELECT "chance", "id", "itemId", "monsterId" FROM "Drop";
DROP TABLE "Drop";
ALTER TABLE "new_Drop" RENAME TO "Drop";
CREATE UNIQUE INDEX "Drop_monsterId_itemId_key" ON "Drop"("monsterId", "itemId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
