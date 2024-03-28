-- CreateTable
CREATE TABLE "User" (
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

-- CreateTable
CREATE TABLE "Stats" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "experience" INTEGER NOT NULL DEFAULT 1,
    "health" INTEGER NOT NULL DEFAULT 20,
    "maxHealth" INTEGER NOT NULL DEFAULT 20,
    "mana" INTEGER NOT NULL DEFAULT 20,
    "maxMana" INTEGER NOT NULL DEFAULT 20,
    "attack" INTEGER NOT NULL DEFAULT 1,
    "str" INTEGER NOT NULL DEFAULT 1,
    "agi" INTEGER NOT NULL DEFAULT 1,
    "int" INTEGER NOT NULL DEFAULT 1,
    "userEmail" TEXT NOT NULL,
    CONSTRAINT "Stats_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stack" INTEGER NOT NULL,
    "userEmail" TEXT NOT NULL,
    "itemId" INTEGER NOT NULL,
    CONSTRAINT "InventoryItem_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EquippedItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userEmail" TEXT NOT NULL,
    "itemId" INTEGER NOT NULL,
    CONSTRAINT "EquippedItem_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EquippedItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Appearance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "head" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "costume" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    CONSTRAINT "Appearance_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Head" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "image" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "MarketListing" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "price" INTEGER NOT NULL,
    "stack" INTEGER NOT NULL,
    "inventoryId" INTEGER NOT NULL,
    "sellerEmail" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME,
    CONSTRAINT "MarketListing_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "InventoryItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketListing_sellerEmail_fkey" FOREIGN KEY ("sellerEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "attack" INTEGER,
    "str" INTEGER,
    "agi" INTEGER,
    "int" INTEGER,
    "health" INTEGER,
    "mana" INTEGER
);

-- CreateTable
CREATE TABLE "Drop" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chance" INTEGER NOT NULL,
    "minAmount" INTEGER NOT NULL DEFAULT 1,
    "maxAmount" INTEGER NOT NULL DEFAULT 1,
    "monsterId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    CONSTRAINT "Drop_monsterId_fkey" FOREIGN KEY ("monsterId") REFERENCES "Monster" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Drop_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Monster" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "boss" BOOLEAN NOT NULL DEFAULT false,
    "attack" INTEGER NOT NULL DEFAULT 1,
    "health" INTEGER NOT NULL DEFAULT 1,
    "silver" INTEGER NOT NULL DEFAULT 1,
    "exp" INTEGER NOT NULL DEFAULT 1,
    "mapId" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "Monster_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "Map" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Map" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "image" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Party" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "leaderEmail" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Profession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "costume" TEXT NOT NULL DEFAULT 'none',
    "attack" INTEGER NOT NULL DEFAULT 1,
    "health" INTEGER NOT NULL DEFAULT 1,
    "mana" INTEGER NOT NULL DEFAULT 1,
    "str" INTEGER NOT NULL DEFAULT 1,
    "agi" INTEGER NOT NULL DEFAULT 1,
    "int" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "requiredLevel" INTEGER NOT NULL DEFAULT 1,
    "manaCost" INTEGER NOT NULL DEFAULT 1,
    "cooldown" INTEGER NOT NULL DEFAULT 1,
    "category" TEXT NOT NULL DEFAULT 'target_enemy',
    "effect" TEXT,
    "name" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT 'Skill Description',
    "attribute" TEXT NOT NULL,
    "multiplier" INTEGER NOT NULL DEFAULT 1,
    "professionId" INTEGER NOT NULL,
    "buffId" INTEGER,
    CONSTRAINT "Skill_professionId_fkey" FOREIGN KEY ("professionId") REFERENCES "Profession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Skill_buffId_fkey" FOREIGN KEY ("buffId") REFERENCES "Buff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LearnedSkill" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userEmail" TEXT NOT NULL,
    "skillId" INTEGER NOT NULL,
    "masteryLevel" INTEGER NOT NULL DEFAULT 1,
    "equipped" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "LearnedSkill_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LearnedSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Mail" (
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
    CONSTRAINT "Mail_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Mail_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserBuff" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "buffId" INTEGER NOT NULL,
    "userEmail" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    CONSTRAINT "UserBuff_buffId_fkey" FOREIGN KEY ("buffId") REFERENCES "Buff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserBuff_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Buff" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "effect" TEXT NOT NULL DEFAULT 'none',
    "duration" INTEGER NOT NULL,
    "image" TEXT NOT NULL,
    "pose" TEXT NOT NULL DEFAULT 'default',
    "persist" BOOLEAN NOT NULL DEFAULT false,
    "maxStack" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "Guild" (
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
    "permissionLevel" INTEGER NOT NULL DEFAULT 0,
    "contribution" INTEGER NOT NULL DEFAULT 0,
    "guildTokens" INTEGER NOT NULL DEFAULT 0,
    "userEmail" TEXT NOT NULL,
    "guildId" INTEGER,
    CONSTRAINT "GuildMember_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GuildMember_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Stats_userEmail_key" ON "Stats"("userEmail");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_userEmail_itemId_key" ON "InventoryItem"("userEmail", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "EquippedItem_userEmail_itemId_key" ON "EquippedItem"("userEmail", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "Appearance_userEmail_key" ON "Appearance"("userEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Head_name_gender_key" ON "Head"("name", "gender");

-- CreateIndex
CREATE UNIQUE INDEX "MarketListing_inventoryId_key" ON "MarketListing"("inventoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Drop_monsterId_itemId_key" ON "Drop"("monsterId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "Party_leaderEmail_key" ON "Party"("leaderEmail");

-- CreateIndex
CREATE UNIQUE INDEX "LearnedSkill_userEmail_skillId_key" ON "LearnedSkill"("userEmail", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBuff_userEmail_buffId_key" ON "UserBuff"("userEmail", "buffId");

-- CreateIndex
CREATE UNIQUE INDEX "Buff_name_key" ON "Buff"("name");

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
