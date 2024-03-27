-- CreateTable
CREATE TABLE "Guild" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "leaderEmail" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL DEFAULT 'https://kidmortal.sirv.com/misc/guild_image.png',
    "level" INTEGER NOT NULL DEFAULT 1,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "taskPoints" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "CurrentGuildTask" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildTaskId" INTEGER NOT NULL,
    "remainingKills" INTEGER NOT NULL,
    "guildId" INTEGER NOT NULL,
    CONSTRAINT "CurrentGuildTask_guildTaskId_fkey" FOREIGN KEY ("guildTaskId") REFERENCES "GuildTask" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CurrentGuildTask_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GuildTask" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "mapId" INTEGER NOT NULL,
    "killCount" INTEGER NOT NULL DEFAULT 10,
    "taskPoints" INTEGER NOT NULL DEFAULT 10,
    CONSTRAINT "GuildTask_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "Map" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GuildMember" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "role" TEXT NOT NULL DEFAULT 'member',
    "contribution" INTEGER NOT NULL DEFAULT 0,
    "guildTokens" INTEGER NOT NULL DEFAULT 0,
    "userEmail" TEXT NOT NULL,
    "guildId" INTEGER,
    CONSTRAINT "GuildMember_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GuildMember_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Guild_name_key" ON "Guild"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Guild_leaderEmail_key" ON "Guild"("leaderEmail");

-- CreateIndex
CREATE UNIQUE INDEX "CurrentGuildTask_guildId_key" ON "CurrentGuildTask"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "GuildTask_name_key" ON "GuildTask"("name");

-- CreateIndex
CREATE UNIQUE INDEX "GuildMember_userEmail_key" ON "GuildMember"("userEmail");

-- CreateIndex
CREATE UNIQUE INDEX "GuildMember_userEmail_guildId_key" ON "GuildMember"("userEmail", "guildId");
