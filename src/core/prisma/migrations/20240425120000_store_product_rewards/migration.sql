-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StoreProduct" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "silver" INTEGER NOT NULL DEFAULT 0,
    "itemId" INTEGER,
    "itemStack" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "StoreProduct_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_StoreProduct" ("id", "name", "displayName") SELECT "id", "name", "displayName" FROM "StoreProduct";
DROP TABLE "StoreProduct";
ALTER TABLE "new_StoreProduct" RENAME TO "StoreProduct";
CREATE UNIQUE INDEX "StoreProduct_name_key" ON "StoreProduct"("name");
CREATE UNIQUE INDEX "StoreProduct_displayName_key" ON "StoreProduct"("displayName");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
