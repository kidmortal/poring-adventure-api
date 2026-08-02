-- AlterTable
ALTER TABLE "GuildMember" ADD COLUMN "bossEntryUsedAt" DATETIME;

-- CreateTable
CREATE TABLE "GuildBoss" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "health" INTEGER NOT NULL DEFAULT 20000,
    "attack" INTEGER NOT NULL DEFAULT 20,
    "taskPoints" INTEGER NOT NULL DEFAULT 100,
    "tokens" INTEGER NOT NULL DEFAULT 100,
    "silver" INTEGER NOT NULL DEFAULT 100,
    "exp" INTEGER NOT NULL DEFAULT 100,
    "requiredGuildLevel" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "CurrentGuildBoss" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" INTEGER NOT NULL,
    "guildBossId" INTEGER NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'easy',
    "maxHealth" INTEGER NOT NULL,
    "health" INTEGER NOT NULL,
    "attack" INTEGER NOT NULL,
    "summonedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CurrentGuildBoss_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CurrentGuildBoss_guildBossId_fkey" FOREIGN KEY ("guildBossId") REFERENCES "GuildBoss" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GuildBossDamage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "currentGuildBossId" INTEGER NOT NULL,
    "userEmail" TEXT NOT NULL,
    "damage" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "GuildBossDamage_currentGuildBossId_fkey" FOREIGN KEY ("currentGuildBossId") REFERENCES "CurrentGuildBoss" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GuildBossDamage_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GuildStoreProduct" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "itemId" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "stack" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "GuildStoreProduct_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "GuildBoss_name_key" ON "GuildBoss"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CurrentGuildBoss_guildId_key" ON "CurrentGuildBoss"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "GuildBossDamage_currentGuildBossId_userEmail_key" ON "GuildBossDamage"("currentGuildBossId", "userEmail");

-- CreateIndex
CREATE UNIQUE INDEX "GuildStoreProduct_itemId_key" ON "GuildStoreProduct"("itemId");

