-- Dungeons: three bosses fought back to back on one entry a day.
--
-- Dungeon bosses are their own table rather than rows in Monster. They have no
-- mapId, so they can never turn up in a random pull, and their numbers sit well
-- above the map curve — which is only affordable because a party gets one
-- attempt a day at them.
--
-- DungeonRun is what makes the gauntlet resumable: the fights are separate
-- battles, and the progress between them has to survive a disconnect.

CREATE TABLE "Dungeon" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "recommendedLevel" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE "DungeonMonster" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dungeonId" INTEGER NOT NULL,
    "stage" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "attack" INTEGER NOT NULL DEFAULT 1,
    "health" INTEGER NOT NULL DEFAULT 1,
    "agi" INTEGER NOT NULL DEFAULT 0,
    "defense" INTEGER NOT NULL DEFAULT 0,
    "silver" INTEGER NOT NULL DEFAULT 1,
    "exp" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "DungeonMonster_dungeonId_fkey" FOREIGN KEY ("dungeonId") REFERENCES "Dungeon" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "DungeonDrop" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "monsterId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "chance" INTEGER NOT NULL,
    "minAmount" INTEGER NOT NULL DEFAULT 1,
    "maxAmount" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "DungeonDrop_monsterId_fkey" FOREIGN KEY ("monsterId") REFERENCES "DungeonMonster" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DungeonDrop_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "DungeonEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userEmail" TEXT NOT NULL,
    "dungeonId" INTEGER NOT NULL,
    "usedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DungeonEntry_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DungeonEntry_dungeonId_fkey" FOREIGN KEY ("dungeonId") REFERENCES "Dungeon" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "DungeonRun" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dungeonId" INTEGER NOT NULL,
    "leaderEmail" TEXT NOT NULL,
    "stage" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    CONSTRAINT "DungeonRun_dungeonId_fkey" FOREIGN KEY ("dungeonId") REFERENCES "Dungeon" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "DungeonRunMember" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dungeonRunId" INTEGER NOT NULL,
    "userEmail" TEXT NOT NULL,
    CONSTRAINT "DungeonRunMember_dungeonRunId_fkey" FOREIGN KEY ("dungeonRunId") REFERENCES "DungeonRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DungeonRunMember_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Dungeon_name_key" ON "Dungeon"("name");
CREATE UNIQUE INDEX "DungeonMonster_dungeonId_stage_key" ON "DungeonMonster"("dungeonId", "stage");
CREATE UNIQUE INDEX "DungeonDrop_monsterId_itemId_key" ON "DungeonDrop"("monsterId", "itemId");
CREATE UNIQUE INDEX "DungeonEntry_userEmail_dungeonId_key" ON "DungeonEntry"("userEmail", "dungeonId");
CREATE INDEX "DungeonRun_status_idx" ON "DungeonRun"("status");
CREATE UNIQUE INDEX "DungeonRunMember_dungeonRunId_userEmail_key" ON "DungeonRunMember"("dungeonRunId", "userEmail");
CREATE INDEX "DungeonRunMember_userEmail_idx" ON "DungeonRunMember"("userEmail");
