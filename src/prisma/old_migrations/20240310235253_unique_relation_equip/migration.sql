/*
  Warnings:

  - A unique constraint covering the columns `[userEmail,itemId]` on the table `EquippedItem` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "EquippedItem_userEmail_itemId_key" ON "EquippedItem"("userEmail", "itemId");
