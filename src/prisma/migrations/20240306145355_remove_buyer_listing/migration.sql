/*
  Warnings:

  - You are about to drop the column `buyerEmail` on the `MarketListing` table. All the data in the column will be lost.
  - Made the column `userEmail` on table `Item` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "stack" INTEGER NOT NULL,
    "image" TEXT,
    "userEmail" TEXT NOT NULL,
    CONSTRAINT "Item_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Item" ("category", "id", "image", "name", "stack", "userEmail") SELECT "category", "id", "image", "name", "stack", "userEmail" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE TABLE "new_MarketListing" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "price" INTEGER NOT NULL,
    "stack" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "sellerEmail" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME,
    CONSTRAINT "MarketListing_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MarketListing_sellerEmail_fkey" FOREIGN KEY ("sellerEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MarketListing" ("createdAt", "expiresAt", "id", "itemId", "price", "sellerEmail", "stack", "updatedAt") SELECT "createdAt", "expiresAt", "id", "itemId", "price", "sellerEmail", "stack", "updatedAt" FROM "MarketListing";
DROP TABLE "MarketListing";
ALTER TABLE "new_MarketListing" RENAME TO "MarketListing";
CREATE UNIQUE INDEX "MarketListing_itemId_key" ON "MarketListing"("itemId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
