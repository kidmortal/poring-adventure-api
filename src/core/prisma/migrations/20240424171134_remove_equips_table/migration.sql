/*
  Warnings:

  - You are about to drop the `EquippedItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "EquippedItem_userEmail_itemId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "EquippedItem";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InventoryItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stack" INTEGER NOT NULL,
    "userEmail" TEXT NOT NULL,
    "itemId" INTEGER NOT NULL,
    "quality" INTEGER NOT NULL DEFAULT 1,
    "enhancement" INTEGER NOT NULL DEFAULT 0,
    "equipped" BOOLEAN NOT NULL DEFAULT false,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "InventoryItem_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_InventoryItem" ("enhancement", "id", "itemId", "quality", "stack", "userEmail") SELECT "enhancement", "id", "itemId", "quality", "stack", "userEmail" FROM "InventoryItem";
DROP TABLE "InventoryItem";
ALTER TABLE "new_InventoryItem" RENAME TO "InventoryItem";
CREATE UNIQUE INDEX "InventoryItem_userEmail_itemId_quality_enhancement_key" ON "InventoryItem"("userEmail", "itemId", "quality", "enhancement");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
