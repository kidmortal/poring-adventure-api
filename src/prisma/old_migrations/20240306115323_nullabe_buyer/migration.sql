-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MarketListing" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "price" INTEGER NOT NULL,
    "stack" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "sellerEmail" TEXT NOT NULL,
    "buyerEmail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME,
    CONSTRAINT "MarketListing_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MarketListing_sellerEmail_fkey" FOREIGN KEY ("sellerEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketListing_buyerEmail_fkey" FOREIGN KEY ("buyerEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MarketListing" ("buyerEmail", "createdAt", "expiresAt", "id", "itemId", "price", "sellerEmail", "stack", "updatedAt") SELECT "buyerEmail", "createdAt", "expiresAt", "id", "itemId", "price", "sellerEmail", "stack", "updatedAt" FROM "MarketListing";
DROP TABLE "MarketListing";
ALTER TABLE "new_MarketListing" RENAME TO "MarketListing";
CREATE UNIQUE INDEX "MarketListing_itemId_key" ON "MarketListing"("itemId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
