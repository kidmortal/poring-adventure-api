/*
  Warnings:

  - You are about to drop the column `userId` on the `UserBuff` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Notification` table. All the data in the column will be lost.
  - Added the required column `userEmail` to the `UserBuff` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userEmail` to the `Notification` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserBuff" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "buffId" INTEGER NOT NULL,
    "userEmail" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    CONSTRAINT "UserBuff_buffId_fkey" FOREIGN KEY ("buffId") REFERENCES "Buff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserBuff_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserBuff" ("buffId", "duration", "id") SELECT "buffId", "duration", "id" FROM "UserBuff";
DROP TABLE "UserBuff";
ALTER TABLE "new_UserBuff" RENAME TO "UserBuff";
CREATE UNIQUE INDEX "UserBuff_userEmail_key" ON "UserBuff"("userEmail");
CREATE TABLE "new_Notification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "content" TEXT NOT NULL,
    "visualized" BOOLEAN NOT NULL,
    "userEmail" TEXT NOT NULL,
    CONSTRAINT "Notification_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Notification" ("content", "id", "visualized") SELECT "content", "id", "visualized" FROM "Notification";
DROP TABLE "Notification";
ALTER TABLE "new_Notification" RENAME TO "Notification";
CREATE UNIQUE INDEX "Notification_userEmail_key" ON "Notification"("userEmail");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
