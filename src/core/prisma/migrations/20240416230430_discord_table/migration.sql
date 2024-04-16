/*
  Warnings:

  - You are about to drop the column `discordId` on the `User` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "Discord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "discordId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    CONSTRAINT "Discord_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "silver" INTEGER NOT NULL DEFAULT 20,
    "admin" BOOLEAN NOT NULL DEFAULT false,
    "professionId" INTEGER,
    "partyId" INTEGER,
    CONSTRAINT "User_professionId_fkey" FOREIGN KEY ("professionId") REFERENCES "Profession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("admin", "email", "id", "name", "partyId", "professionId", "silver") SELECT "admin", "email", "id", "name", "partyId", "professionId", "silver" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE UNIQUE INDEX "Discord_discordId_key" ON "Discord"("discordId");

-- CreateIndex
CREATE UNIQUE INDEX "Discord_userEmail_key" ON "Discord"("userEmail");
