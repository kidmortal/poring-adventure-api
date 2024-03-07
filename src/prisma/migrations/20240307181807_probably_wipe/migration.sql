/*
  Warnings:

  - You are about to drop the column `itemId` on the `MarketListing` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `EquippedItem` table. All the data in the column will be lost.
  - You are about to drop the column `equippedItemsId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `userEmail` on the `Item` table. All the data in the column will be lost.
  - Added the required column `inventoryId` to the `MarketListing` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stack" INTEGER NOT NULL,
    "userEmail" TEXT NOT NULL,
    "itemId" INTEGER NOT NULL,
    CONSTRAINT "InventoryItem_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MarketListing" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "price" INTEGER NOT NULL,
    "stack" INTEGER NOT NULL,
    "inventoryId" INTEGER NOT NULL,
    "sellerEmail" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME,
    CONSTRAINT "MarketListing_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "InventoryItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MarketListing_sellerEmail_fkey" FOREIGN KEY ("sellerEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MarketListing" ("createdAt", "expiresAt", "id", "price", "sellerEmail", "stack", "updatedAt") SELECT "createdAt", "expiresAt", "id", "price", "sellerEmail", "stack", "updatedAt" FROM "MarketListing";
DROP TABLE "MarketListing";
ALTER TABLE "new_MarketListing" RENAME TO "MarketListing";
CREATE UNIQUE INDEX "MarketListing_inventoryId_key" ON "MarketListing"("inventoryId");
CREATE TABLE "new_EquippedItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userEmail" TEXT NOT NULL,
    "itemId" INTEGER NOT NULL,
    CONSTRAINT "EquippedItem_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EquippedItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_EquippedItem" ("id", "itemId", "userEmail") SELECT "id", "itemId", "userEmail" FROM "EquippedItem";
DROP TABLE "EquippedItem";
ALTER TABLE "new_EquippedItem" RENAME TO "EquippedItem";
CREATE UNIQUE INDEX "EquippedItem_itemId_key" ON "EquippedItem"("itemId");
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "classname" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "experience" INTEGER NOT NULL DEFAULT 1,
    "silver" INTEGER NOT NULL DEFAULT 20
);
INSERT INTO "new_User" ("classname", "email", "experience", "id", "level", "name", "silver") SELECT "classname", "email", "experience", "id", "level", "name", "silver" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE TABLE "new_Item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "stack" INTEGER NOT NULL,
    "image" TEXT
);
INSERT INTO "new_Item" ("category", "id", "image", "name", "stack") SELECT "category", "id", "image", "name", "stack" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_itemId_key" ON "InventoryItem"("itemId");
