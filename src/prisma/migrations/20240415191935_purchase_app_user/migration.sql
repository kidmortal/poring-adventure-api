/*
  Warnings:

  - Added the required column `appUserId` to the `UserPurchase` table without a default value. This is not possible if the table is not empty.
  - Added the required column `displayName` to the `StoreProduct` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserPurchase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "transactionId" TEXT NOT NULL,
    "appUserId" TEXT NOT NULL,
    "received" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storeProductId" INTEGER NOT NULL,
    "userEmail" TEXT NOT NULL,
    CONSTRAINT "UserPurchase_storeProductId_fkey" FOREIGN KEY ("storeProductId") REFERENCES "StoreProduct" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserPurchase_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UserPurchase" ("createdAt", "id", "received", "storeProductId", "transactionId", "userEmail") SELECT "createdAt", "id", "received", "storeProductId", "transactionId", "userEmail" FROM "UserPurchase";
DROP TABLE "UserPurchase";
ALTER TABLE "new_UserPurchase" RENAME TO "UserPurchase";
CREATE UNIQUE INDEX "UserPurchase_transactionId_key" ON "UserPurchase"("transactionId");
CREATE TABLE "new_StoreProduct" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL
);
INSERT INTO "new_StoreProduct" ("id", "name") SELECT "id", "name" FROM "StoreProduct";
DROP TABLE "StoreProduct";
ALTER TABLE "new_StoreProduct" RENAME TO "StoreProduct";
CREATE UNIQUE INDEX "StoreProduct_name_key" ON "StoreProduct"("name");
CREATE UNIQUE INDEX "StoreProduct_displayName_key" ON "StoreProduct"("displayName");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
