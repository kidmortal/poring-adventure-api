-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserPurchase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "transactionId" TEXT NOT NULL,
    "appUserId" TEXT NOT NULL,
    "received" BOOLEAN NOT NULL DEFAULT false,
    "refunded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storeProductId" INTEGER NOT NULL,
    "userEmail" TEXT NOT NULL,
    CONSTRAINT "UserPurchase_storeProductId_fkey" FOREIGN KEY ("storeProductId") REFERENCES "StoreProduct" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserPurchase_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UserPurchase" ("appUserId", "createdAt", "id", "received", "storeProductId", "transactionId", "userEmail") SELECT "appUserId", "createdAt", "id", "received", "storeProductId", "transactionId", "userEmail" FROM "UserPurchase";
DROP TABLE "UserPurchase";
ALTER TABLE "new_UserPurchase" RENAME TO "UserPurchase";
CREATE UNIQUE INDEX "UserPurchase_transactionId_key" ON "UserPurchase"("transactionId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
