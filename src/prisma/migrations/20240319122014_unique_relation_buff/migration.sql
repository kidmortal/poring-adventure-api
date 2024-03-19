/*
  Warnings:

  - A unique constraint covering the columns `[userEmail,buffId]` on the table `UserBuff` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "UserBuff_userEmail_key";

-- CreateIndex
CREATE UNIQUE INDEX "UserBuff_userEmail_buffId_key" ON "UserBuff"("userEmail", "buffId");
