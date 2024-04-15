-- CreateTable
CREATE TABLE "UserPurchase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "transactionId" TEXT NOT NULL,
    "received" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storeProductId" INTEGER NOT NULL,
    "userEmail" TEXT NOT NULL,
    CONSTRAINT "UserPurchase_storeProductId_fkey" FOREIGN KEY ("storeProductId") REFERENCES "StoreProduct" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserPurchase_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StoreProduct" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT
);
