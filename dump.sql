PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "Appearance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "head" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "costume" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    CONSTRAINT "Appearance_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "attack" INTEGER,
    "health" INTEGER
, "agi" INTEGER, "int" INTEGER, "mana" INTEGER, "str" INTEGER);
INSERT INTO Item VALUES(11,'Slice of Cake','consumable','https://kidmortal.sirv.com/consumables/slice_of_cake.webp',NULL,10,NULL,NULL,5,NULL);
INSERT INTO Item VALUES(12,'Short Sword','weapon','https://kidmortal.sirv.com/equipments/short_sword.webp',3,5,NULL,NULL,NULL,5);
INSERT INTO Item VALUES(13,'Large Mana Potion','consumable','https://kidmortal.sirv.com/consumables/large_mana_potion.webp',NULL,NULL,NULL,NULL,100,NULL);
INSERT INTO Item VALUES(14,'Large Health Potion','consumable','https://kidmortal.sirv.com/consumables/large_health_potion.webp',NULL,100,NULL,NULL,NULL,NULL);
INSERT INTO Item VALUES(16,'Old Staff','weapon','https://kidmortal.sirv.com/equipments/old_staff.webp',2,0,NULL,5,10,NULL);
INSERT INTO Item VALUES(17,'Small Health Potion','consumable','https://kidmortal.sirv.com/consumables/small_health_potion.webp',NULL,20,NULL,NULL,NULL,NULL);
INSERT INTO Item VALUES(18,'Blade of Asth','weapon','https://kidmortal.sirv.com/equipments/blade_of_asth.webp',50,150,NULL,NULL,NULL,NULL);
INSERT INTO Item VALUES(19,'Elven Staff','weapon','https://kidmortal.sirv.com/equipments/elven_staff.webp',80,20,NULL,NULL,NULL,NULL);
INSERT INTO Item VALUES(20,'Plate Barghar Armor','armor','https://kidmortal.sirv.com/equipments/plate_barghar_armor.webp?w=32&h=32',NULL,50,NULL,NULL,NULL,NULL);
INSERT INTO Item VALUES(21,'Plate Barghar Legs','legs','https://kidmortal.sirv.com/equipments/plate_barghar_legs.webp?w=32&h=32',NULL,40,NULL,NULL,NULL,NULL);
INSERT INTO Item VALUES(22,'Plate Barghar Boots','boots','https://kidmortal.sirv.com/equipments/plate_barghar_boots.webp?w=32&h=32',NULL,40,NULL,NULL,NULL,NULL);
INSERT INTO Item VALUES(23,'Cloth Forest Armor','armor','https://kidmortal.sirv.com/equipments/cloth_forest_armor.webp?w=32&h=32',NULL,20,NULL,3,5,NULL);
INSERT INTO Item VALUES(24,'Cloth Forest Legs','legs','https://kidmortal.sirv.com/equipments/cloth_forest_legs.webp?w=32&h=32',NULL,15,NULL,2,5,NULL);
INSERT INTO Item VALUES(25,'Cloth Forest Boots','boots','https://kidmortal.sirv.com/equipments/cloth_forest_boots.webp?w=32&h=32',NULL,15,NULL,2,5,NULL);
INSERT INTO Item VALUES(26,'Bread','consumable','https://kidmortal.sirv.com/consumables/bread.webp',NULL,10,NULL,NULL,10,NULL);
CREATE TABLE IF NOT EXISTS "Drop" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chance" INTEGER NOT NULL,
    "minAmount" INTEGER NOT NULL DEFAULT 1,
    "maxAmount" INTEGER NOT NULL DEFAULT 1,
    "monsterId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    CONSTRAINT "Drop_monsterId_fkey" FOREIGN KEY ("monsterId") REFERENCES "Monster" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Drop_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "Drop" VALUES(1,20,1,1,1,12);
INSERT INTO "Drop" VALUES(2,80,1,2,1,11);
INSERT INTO "Drop" VALUES(3,1,1,1,4,18);
INSERT INTO "Drop" VALUES(4,1,1,1,4,19);
INSERT INTO "Drop" VALUES(5,10,1,1,1,16);
INSERT INTO "Drop" VALUES(6,15,1,1,2,25);
INSERT INTO "Drop" VALUES(7,15,1,1,2,24);
INSERT INTO "Drop" VALUES(8,15,1,1,2,23);
INSERT INTO "Drop" VALUES(9,40,1,3,4,14);
INSERT INTO "Drop" VALUES(10,40,1,3,4,13);
INSERT INTO "Drop" VALUES(11,80,1,3,3,26);
CREATE TABLE IF NOT EXISTS "Party" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "leaderEmail" TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS "Stats" (
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

CREATE TABLE IF NOT EXISTS "Notification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "content" TEXT NOT NULL,
    "visualized" BOOLEAN NOT NULL,
    "userId" INTEGER NOT NULL,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "Skill" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "requiredLevel" INTEGER NOT NULL DEFAULT 1,
    "manaCost" INTEGER NOT NULL DEFAULT 1,
    "category" TEXT NOT NULL DEFAULT 'targetEnemy',
    "effect" TEXT,
    "name" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "attribute" TEXT NOT NULL,
    "multiplier" INTEGER NOT NULL DEFAULT 1,
    "professionId" INTEGER NOT NULL,
    CONSTRAINT "Skill_professionId_fkey" FOREIGN KEY ("professionId") REFERENCES "Profession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO Skill VALUES(1,1,2,'target_enemy','','Fire Slash','https://kidmortal.sirv.com/skills/fire_slash.webp','str',2,1);
INSERT INTO Skill VALUES(2,1,3,'target_ally','healing','Light Healing','https://kidmortal.sirv.com/skills/healing.webp','int',3,2);
INSERT INTO Skill VALUES(3,1,2,'target_enemy',NULL,'Light Missile','https://kidmortal.sirv.com/skills/light_missile.webp','int',2,2);
INSERT INTO Skill VALUES(4,3,5,'target_enemy',NULL,'Water Flash','https://kidmortal.sirv.com/skills/water_slash.webp','int',3,1);
INSERT INTO Skill VALUES(5,1,2,'target_enemy',NULL,'Fireball','https://kidmortal.sirv.com/skills/fireball.webp','int',2,3);
INSERT INTO Skill VALUES(6,1,5,'target_enemy',NULL,'Icicle','https://kidmortal.sirv.com/skills/ice_shards.webp','int',4,3);
INSERT INTO Skill VALUES(7,1,0,'target_ally','infusion','Mana Infusion','https://kidmortal.sirv.com/skills/infusion.webp','int',2,2);
INSERT INTO Skill VALUES(8,1,2,'target_enemy',NULL,'Backstab','https://kidmortal.sirv.com/skills/backstab.webp','agi',4,5);
CREATE TABLE IF NOT EXISTS "EquippedItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userEmail" TEXT NOT NULL,
    "itemId" INTEGER NOT NULL,
    CONSTRAINT "EquippedItem_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EquippedItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "InventoryItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stack" INTEGER NOT NULL,
    "userEmail" TEXT NOT NULL,
    "itemId" INTEGER NOT NULL,
    CONSTRAINT "InventoryItem_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "MarketListing" (
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

CREATE TABLE IF NOT EXISTS "User" (
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

CREATE TABLE IF NOT EXISTS "LearnedSkill" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userEmail" TEXT NOT NULL,
    "skillId" INTEGER NOT NULL,
    "masteryLevel" INTEGER NOT NULL DEFAULT 1,
    "equipped" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "LearnedSkill_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LearnedSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Profession" (
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
INSERT INTO Profession VALUES(1,'Rune Knight','rune_knight',3,5,2,2,1,1);
INSERT INTO Profession VALUES(2,'Priest','priest',1,2,5,1,1,3);
INSERT INTO Profession VALUES(3,'Mage','mage',1,2,5,1,1,3);
INSERT INTO Profession VALUES(4,'Knight','knight',2,6,1,3,1,1);
INSERT INTO Profession VALUES(5,'Assassin','assassin',5,2,2,1,3,1);
CREATE TABLE IF NOT EXISTS "Monster" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "boss" BOOLEAN NOT NULL DEFAULT false,
    "attack" INTEGER NOT NULL DEFAULT 1,
    "health" INTEGER NOT NULL DEFAULT 1,
    "silver" INTEGER NOT NULL DEFAULT 1,
    "exp" INTEGER NOT NULL DEFAULT 1
);
INSERT INTO Monster VALUES(1,'Poring','https://kidmortal.sirv.com/monsters/poring.gif',1,0,1,10,5,3);
INSERT INTO Monster VALUES(2,'Fire Poring','https://kidmortal.sirv.com/monsters/fire_poring.gif',1,0,2,25,15,8);
INSERT INTO Monster VALUES(3,'Lunatic','https://kidmortal.sirv.com/monsters/lunatic.gif',1,0,5,50,25,14);
INSERT INTO Monster VALUES(4,'King Poring','https://kidmortal.sirv.com/monsters/king_poring.gif?w=120&h=120',10,'true',10,850,220,200);
DELETE FROM sqlite_sequence;
INSERT INTO sqlite_sequence VALUES('Appearance',64);
INSERT INTO sqlite_sequence VALUES('Item',26);
INSERT INTO sqlite_sequence VALUES('Drop',11);
INSERT INTO sqlite_sequence VALUES('Party',11);
INSERT INTO sqlite_sequence VALUES('Stats',28);
INSERT INTO sqlite_sequence VALUES('Skill',8);
INSERT INTO sqlite_sequence VALUES('EquippedItem',64);
INSERT INTO sqlite_sequence VALUES('InventoryItem',119);
INSERT INTO sqlite_sequence VALUES('MarketListing',85);
INSERT INTO sqlite_sequence VALUES('User',30);
INSERT INTO sqlite_sequence VALUES('LearnedSkill',22);
INSERT INTO sqlite_sequence VALUES('Profession',5);
INSERT INTO sqlite_sequence VALUES('Monster',4);
CREATE UNIQUE INDEX "Appearance_userEmail_key" ON "Appearance" ("userEmail");
CREATE UNIQUE INDEX "Drop_monsterId_itemId_key" ON "Drop" ("monsterId", "itemId");
CREATE UNIQUE INDEX "Party_leaderEmail_key" ON "Party" ("leaderEmail");
CREATE UNIQUE INDEX "Stats_userEmail_key" ON "Stats" ("userEmail");
CREATE UNIQUE INDEX "EquippedItem_userEmail_itemId_key" ON "EquippedItem" ("userEmail", "itemId");
CREATE UNIQUE INDEX "InventoryItem_userEmail_itemId_key" ON "InventoryItem" ("userEmail", "itemId");
CREATE UNIQUE INDEX "MarketListing_inventoryId_key" ON "MarketListing" ("inventoryId");
CREATE UNIQUE INDEX "User_email_key" ON "User" ("email");
CREATE UNIQUE INDEX "LearnedSkill_userEmail_skillId_key" ON "LearnedSkill" ("userEmail", "skillId");
COMMIT;
