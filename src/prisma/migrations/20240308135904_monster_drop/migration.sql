/*
  Warnings:

  - Made the column `image` on table `Item` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateTable
CREATE TABLE "Drop" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chance" INTEGER NOT NULL,
    "monsterId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    CONSTRAINT "Drop_monsterId_fkey" FOREIGN KEY ("monsterId") REFERENCES "Monster" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Drop_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Monster" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "attack" INTEGER NOT NULL,
    "health" INTEGER NOT NULL
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "attack" INTEGER,
    "health" INTEGER
);
INSERT INTO "new_Item" ("attack", "category", "health", "id", "image", "name") SELECT "attack", "category", "health", "id", "image", "name" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE UNIQUE INDEX "Drop_monsterId_itemId_key" ON "Drop"("monsterId", "itemId");
