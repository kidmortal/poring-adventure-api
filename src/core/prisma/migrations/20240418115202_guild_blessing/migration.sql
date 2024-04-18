-- CreateTable
CREATE TABLE "GuildBlessing" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" INTEGER NOT NULL,
    "health" INTEGER NOT NULL DEFAULT 5,
    "mana" INTEGER NOT NULL DEFAULT 5,
    "str" INTEGER NOT NULL DEFAULT 1,
    "int" INTEGER NOT NULL DEFAULT 1,
    "agi" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "GuildBlessing_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "GuildBlessing_guildId_key" ON "GuildBlessing"("guildId");
