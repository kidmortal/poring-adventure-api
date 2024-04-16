/*
  Warnings:

  - A unique constraint covering the columns `[transactionId]` on the table `UserPurchase` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "UserPurchase_transactionId_key" ON "UserPurchase"("transactionId");
