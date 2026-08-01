-- Profession presentation fields
ALTER TABLE "Profession" ADD COLUMN "icon" TEXT NOT NULL DEFAULT '❔';
ALTER TABLE "Profession" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX "Profession_name_key" ON "Profession"("name");

-- Per-user profession progression
CREATE TABLE "UserProfession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userEmail" TEXT NOT NULL,
    "professionId" INTEGER NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "learnedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserProfession_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserProfession_professionId_fkey" FOREIGN KEY ("professionId") REFERENCES "Profession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UserProfession_userEmail_professionId_key" ON "UserProfession"("userEmail", "professionId");

-- Existing characters keep the profession they were created with, at the level
-- their account already reached.
INSERT INTO "UserProfession" ("userEmail", "professionId", "level", "experience")
SELECT "User"."email", "User"."professionId", COALESCE("Stats"."level", 1), 0
FROM "User"
LEFT JOIN "Stats" ON "Stats"."userEmail" = "User"."email"
WHERE "User"."professionId" IS NOT NULL;

-- Daily stamina
ALTER TABLE "Stats" ADD COLUMN "stamina" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "Stats" ADD COLUMN "maxStamina" INTEGER NOT NULL DEFAULT 50;
-- SQLite refuses a non-constant default in ADD COLUMN, so the epoch stands in
-- for "never refilled": every existing character gets a full bar the first
-- time they are read.
ALTER TABLE "Stats" ADD COLUMN "staminaRefilledAt" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00';
