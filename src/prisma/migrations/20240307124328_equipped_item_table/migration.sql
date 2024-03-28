-- AlterTable
ALTER TABLE "User" ADD COLUMN "equippedItemsId" INTEGER;

-- CreateTable
CREATE TABLE "EquippedItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "itemId" INTEGER NOT NULL,
    CONSTRAINT "EquippedItem_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EquippedItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "EquippedItem_userEmail_key" ON "EquippedItem"("userEmail");

-- CreateIndex
CREATE UNIQUE INDEX "EquippedItem_itemId_key" ON "EquippedItem"("itemId");
