-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EquippedItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userEmail" TEXT NOT NULL,
    "itemId" INTEGER NOT NULL,
    CONSTRAINT "EquippedItem_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EquippedItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EquippedItem" ("id", "itemId", "userEmail") SELECT "id", "itemId", "userEmail" FROM "EquippedItem";
DROP TABLE "EquippedItem";
ALTER TABLE "new_EquippedItem" RENAME TO "EquippedItem";
CREATE UNIQUE INDEX "EquippedItem_userEmail_itemId_key" ON "EquippedItem"("userEmail", "itemId");
CREATE TABLE "new_LearnedSkill" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userEmail" TEXT NOT NULL,
    "skillId" INTEGER NOT NULL,
    "masteryLevel" INTEGER NOT NULL,
    "equipped" BOOLEAN NOT NULL,
    CONSTRAINT "LearnedSkill_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LearnedSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LearnedSkill" ("equipped", "id", "masteryLevel", "skillId", "userEmail") SELECT "equipped", "id", "masteryLevel", "skillId", "userEmail" FROM "LearnedSkill";
DROP TABLE "LearnedSkill";
ALTER TABLE "new_LearnedSkill" RENAME TO "LearnedSkill";
CREATE UNIQUE INDEX "LearnedSkill_userEmail_skillId_key" ON "LearnedSkill"("userEmail", "skillId");
CREATE TABLE "new_InventoryItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stack" INTEGER NOT NULL,
    "userEmail" TEXT NOT NULL,
    "itemId" INTEGER NOT NULL,
    CONSTRAINT "InventoryItem_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_InventoryItem" ("id", "itemId", "stack", "userEmail") SELECT "id", "itemId", "stack", "userEmail" FROM "InventoryItem";
DROP TABLE "InventoryItem";
ALTER TABLE "new_InventoryItem" RENAME TO "InventoryItem";
CREATE UNIQUE INDEX "InventoryItem_userEmail_itemId_key" ON "InventoryItem"("userEmail", "itemId");
CREATE TABLE "new_MarketListing" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "price" INTEGER NOT NULL,
    "stack" INTEGER NOT NULL,
    "inventoryId" INTEGER NOT NULL,
    "sellerEmail" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME,
    CONSTRAINT "MarketListing_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "InventoryItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketListing_sellerEmail_fkey" FOREIGN KEY ("sellerEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MarketListing" ("createdAt", "expiresAt", "id", "inventoryId", "price", "sellerEmail", "stack", "updatedAt") SELECT "createdAt", "expiresAt", "id", "inventoryId", "price", "sellerEmail", "stack", "updatedAt" FROM "MarketListing";
DROP TABLE "MarketListing";
ALTER TABLE "new_MarketListing" RENAME TO "MarketListing";
CREATE UNIQUE INDEX "MarketListing_inventoryId_key" ON "MarketListing"("inventoryId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
