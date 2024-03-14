/*
  Warnings:

  - You are about to drop the column `classname` on the `User` table. All the data in the column will be lost.

*/
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
CREATE TABLE "new_LearnedSkill" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userEmail" TEXT NOT NULL,
    "skillId" INTEGER NOT NULL,
    "masteryLevel" INTEGER NOT NULL DEFAULT 1,
    "equipped" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "LearnedSkill_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LearnedSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LearnedSkill" ("equipped", "id", "masteryLevel", "skillId", "userEmail") SELECT "equipped", "id", "masteryLevel", "skillId", "userEmail" FROM "LearnedSkill";
DROP TABLE "LearnedSkill";
ALTER TABLE "new_LearnedSkill" RENAME TO "LearnedSkill";
CREATE UNIQUE INDEX "LearnedSkill_userEmail_skillId_key" ON "LearnedSkill"("userEmail", "skillId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
