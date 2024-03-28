/*
  Warnings:

  - Added the required column `sender` to the `Notification` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Notification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sender" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "silver" INTEGER DEFAULT 0,
    "itemId" INTEGER,
    "itemStack" INTEGER,
    "visualized" BOOLEAN NOT NULL,
    "userEmail" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Notification_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Notification" ("claimed", "content", "createdAt", "id", "itemId", "itemStack", "silver", "userEmail", "visualized") SELECT "claimed", "content", "createdAt", "id", "itemId", "itemStack", "silver", "userEmail", "visualized" FROM "Notification";
DROP TABLE "Notification";
ALTER TABLE "new_Notification" RENAME TO "Notification";
CREATE UNIQUE INDEX "Notification_userEmail_key" ON "Notification"("userEmail");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
