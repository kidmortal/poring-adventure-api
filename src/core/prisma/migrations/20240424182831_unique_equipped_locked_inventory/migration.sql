/*
  Warnings:

  - A unique constraint covering the columns `[userEmail,itemId,quality,enhancement,equipped,locked]` on the table `InventoryItem` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "InventoryItem_userEmail_itemId_quality_enhancement_key";

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_userEmail_itemId_quality_enhancement_equipped_locked_key" ON "InventoryItem"("userEmail", "itemId", "quality", "enhancement", "equipped", "locked");
