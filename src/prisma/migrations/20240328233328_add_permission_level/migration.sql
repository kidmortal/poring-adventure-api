-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GuildMember" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "role" TEXT NOT NULL DEFAULT 'member',
    "permissionLevel" INTEGER NOT NULL DEFAULT 0,
    "contribution" INTEGER NOT NULL DEFAULT 0,
    "guildTokens" INTEGER NOT NULL DEFAULT 0,
    "userEmail" TEXT NOT NULL,
    "guildId" INTEGER,
    CONSTRAINT "GuildMember_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GuildMember_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_GuildMember" ("contribution", "guildId", "guildTokens", "id", "role", "userEmail") SELECT "contribution", "guildId", "guildTokens", "id", "role", "userEmail" FROM "GuildMember";
DROP TABLE "GuildMember";
ALTER TABLE "new_GuildMember" RENAME TO "GuildMember";
CREATE UNIQUE INDEX "GuildMember_userEmail_key" ON "GuildMember"("userEmail");
CREATE UNIQUE INDEX "GuildMember_userEmail_guildId_key" ON "GuildMember"("userEmail", "guildId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
