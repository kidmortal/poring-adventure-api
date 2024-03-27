-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Guild" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "leaderEmail" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL DEFAULT 'https://kidmortal.sirv.com/misc/guild_image.png',
    "level" INTEGER NOT NULL DEFAULT 1,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "taskPoints" INTEGER NOT NULL DEFAULT 0,
    "publicMessage" TEXT NOT NULL DEFAULT 'Lets have fun',
    "internalMessage" TEXT NOT NULL DEFAULT 'Lets have fun'
);
INSERT INTO "new_Guild" ("experience", "id", "imageUrl", "leaderEmail", "level", "name", "taskPoints") SELECT "experience", "id", "imageUrl", "leaderEmail", "level", "name", "taskPoints" FROM "Guild";
DROP TABLE "Guild";
ALTER TABLE "new_Guild" RENAME TO "Guild";
CREATE UNIQUE INDEX "Guild_name_key" ON "Guild"("name");
CREATE UNIQUE INDEX "Guild_leaderEmail_key" ON "Guild"("leaderEmail");
CREATE TABLE "new_Notification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
INSERT INTO "new_Notification" ("content", "createdAt", "id", "userEmail", "visualized") SELECT "content", "createdAt", "id", "userEmail", "visualized" FROM "Notification";
DROP TABLE "Notification";
ALTER TABLE "new_Notification" RENAME TO "Notification";
CREATE UNIQUE INDEX "Notification_userEmail_key" ON "Notification"("userEmail");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
