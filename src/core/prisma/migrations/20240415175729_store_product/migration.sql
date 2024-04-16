/*
  Warnings:

  - Added the required column `name` to the `StoreProduct` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StoreProduct" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);
INSERT INTO "new_StoreProduct" ("id") SELECT "id" FROM "StoreProduct";
DROP TABLE "StoreProduct";
ALTER TABLE "new_StoreProduct" RENAME TO "StoreProduct";
CREATE UNIQUE INDEX "StoreProduct_name_key" ON "StoreProduct"("name");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
