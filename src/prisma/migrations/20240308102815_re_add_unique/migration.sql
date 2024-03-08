/*
  Warnings:

  - A unique constraint covering the columns `[userEmail,itemId]` on the table `InventoryItem` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_userEmail_itemId_key" ON "InventoryItem"("userEmail", "itemId");
