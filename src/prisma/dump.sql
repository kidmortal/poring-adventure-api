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
INSERT INTO Appearance VALUES(32,'2','male','rune_knight','kidmortal@gmail.com');
INSERT INTO Appearance VALUES(37,'1','female','priest','isaacalvesx7@gmail.com');
INSERT INTO Appearance VALUES(39,'cat','female','knight','aenf2027@gmail.com');
INSERT INTO Appearance VALUES(44,'cat','female','priest','amanda96akiau@gmail.com');
INSERT INTO Appearance VALUES(47,'1','male','knight','xxdennyxpvpxx@gmail.com');
INSERT INTO Appearance VALUES(48,'cat','female','priest','paloma.santos@amopromo.com');
INSERT INTO Appearance VALUES(49,'1','female','mage','leoviggiano1@gmail.com');
INSERT INTO Appearance VALUES(59,'1','male','priest','leoslimaxv@gmail.com');
INSERT INTO Appearance VALUES(60,'1','female','mage','skoczencezary@gmail.com');
INSERT INTO Appearance VALUES(63,'1','male','assassin','jarukitsun@gmail.com');
INSERT INTO Appearance VALUES(64,'1','male','mage','allan.oliveira@amopromo.com');
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
INSERT INTO Party VALUES(10,'kidmortal@gmail.com');
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
INSERT INTO Stats VALUES(2,6,2021,149,155,17,35,13,18,6,8,'kidmortal@gmail.com');
INSERT INTO Stats VALUES(3,1,1,11,20,20,20,1,1,1,1,'isaacalvesx7@gmail.com');
INSERT INTO Stats VALUES(4,1,9,30,30,20,20,7,1,1,1,'aenf2027@gmail.com');
INSERT INTO Stats VALUES(8,1,18,150,150,20,20,6,1,1,1,'amanda96akiau@gmail.com');
INSERT INTO Stats VALUES(11,1,1,11,20,20,20,1,1,1,1,'xxdennyxpvpxx@gmail.com');
INSERT INTO Stats VALUES(12,20,20229,215,258,467,130,70,20,20,65,'paloma.santos@amopromo.com');
INSERT INTO Stats VALUES(13,1,1,25,25,20,20,4,1,1,1,'leoviggiano1@gmail.com');
INSERT INTO Stats VALUES(23,3,247,24,24,22,40,5,3,3,12,'leoslimaxv@gmail.com');
INSERT INTO Stats VALUES(24,1,82,12,40,13,25,1,1,1,4,'skoczencezary@gmail.com');
INSERT INTO Stats VALUES(27,2,101,22,42,18,27,9,7,4,4,'jarukitsun@gmail.com');
INSERT INTO Stats VALUES(28,1,1,20,20,20,20,1,1,1,1,'allan.oliveira@amopromo.com');
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
INSERT INTO EquippedItem VALUES(23,'leoviggiano1@gmail.com',12);
INSERT INTO EquippedItem VALUES(25,'amanda96akiau@gmail.com',16);
INSERT INTO EquippedItem VALUES(44,'kidmortal@gmail.com',12);
INSERT INTO EquippedItem VALUES(46,'leoslimaxv@gmail.com',16);
INSERT INTO EquippedItem VALUES(47,'amanda96akiau@gmail.com',20);
INSERT INTO EquippedItem VALUES(48,'amanda96akiau@gmail.com',22);
INSERT INTO EquippedItem VALUES(49,'amanda96akiau@gmail.com',21);
INSERT INTO EquippedItem VALUES(52,'paloma.santos@amopromo.com',23);
INSERT INTO EquippedItem VALUES(53,'paloma.santos@amopromo.com',24);
INSERT INTO EquippedItem VALUES(54,'paloma.santos@amopromo.com',25);
INSERT INTO EquippedItem VALUES(55,'kidmortal@gmail.com',20);
INSERT INTO EquippedItem VALUES(56,'kidmortal@gmail.com',21);
INSERT INTO EquippedItem VALUES(58,'paloma.santos@amopromo.com',18);
INSERT INTO EquippedItem VALUES(59,'kidmortal@gmail.com',25);
INSERT INTO EquippedItem VALUES(60,'skoczencezary@gmail.com',23);
INSERT INTO EquippedItem VALUES(62,'jarukitsun@gmail.com',12);
INSERT INTO EquippedItem VALUES(63,'jarukitsun@gmail.com',25);
INSERT INTO EquippedItem VALUES(64,'aenf2027@gmail.com',12);
CREATE TABLE IF NOT EXISTS "InventoryItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stack" INTEGER NOT NULL,
    "userEmail" TEXT NOT NULL,
    "itemId" INTEGER NOT NULL,
    CONSTRAINT "InventoryItem_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO InventoryItem VALUES(1,166,'kidmortal@gmail.com',11);
INSERT INTO InventoryItem VALUES(2,5,'kidmortal@gmail.com',13);
INSERT INTO InventoryItem VALUES(17,1,'amanda96akiau@gmail.com',13);
INSERT INTO InventoryItem VALUES(20,10,'kidmortal@gmail.com',12);
INSERT INTO InventoryItem VALUES(23,87,'amanda96akiau@gmail.com',11);
INSERT INTO InventoryItem VALUES(24,31,'amanda96akiau@gmail.com',12);
INSERT INTO InventoryItem VALUES(34,1,'xxdennyxpvpxx@gmail.com',11);
INSERT INTO InventoryItem VALUES(35,4,'aenf2027@gmail.com',11);
INSERT INTO InventoryItem VALUES(46,19,'paloma.santos@amopromo.com',16);
INSERT INTO InventoryItem VALUES(51,1,'leoviggiano1@gmail.com',12);
INSERT INTO InventoryItem VALUES(52,1,'leoviggiano1@gmail.com',11);
INSERT INTO InventoryItem VALUES(54,12,'kidmortal@gmail.com',16);
INSERT INTO InventoryItem VALUES(55,1,'aenf2027@gmail.com',12);
INSERT INTO InventoryItem VALUES(57,2,'amanda96akiau@gmail.com',16);
INSERT INTO InventoryItem VALUES(73,6,'leoslimaxv@gmail.com',11);
INSERT INTO InventoryItem VALUES(75,3,'leoslimaxv@gmail.com',16);
INSERT INTO InventoryItem VALUES(83,61,'paloma.santos@amopromo.com',12);
INSERT INTO InventoryItem VALUES(93,256,'paloma.santos@amopromo.com',11);
INSERT INTO InventoryItem VALUES(94,8,'paloma.santos@amopromo.com',23);
INSERT INTO InventoryItem VALUES(95,12,'paloma.santos@amopromo.com',25);
INSERT INTO InventoryItem VALUES(96,14,'paloma.santos@amopromo.com',24);
INSERT INTO InventoryItem VALUES(97,35,'paloma.santos@amopromo.com',13);
INSERT INTO InventoryItem VALUES(98,42,'paloma.santos@amopromo.com',14);
INSERT INTO InventoryItem VALUES(99,93,'paloma.santos@amopromo.com',26);
INSERT INTO InventoryItem VALUES(101,20,'kidmortal@gmail.com',26);
INSERT INTO InventoryItem VALUES(102,5,'kidmortal@gmail.com',14);
INSERT INTO InventoryItem VALUES(103,1,'kidmortal@gmail.com',24);
INSERT INTO InventoryItem VALUES(105,1,'kidmortal@gmail.com',22);
INSERT INTO InventoryItem VALUES(108,9,'skoczencezary@gmail.com',26);
INSERT INTO InventoryItem VALUES(110,1,'aenf2027@gmail.com',24);
INSERT INTO InventoryItem VALUES(114,15,'jarukitsun@gmail.com',11);
INSERT INTO InventoryItem VALUES(115,8,'jarukitsun@gmail.com',26);
INSERT INTO InventoryItem VALUES(116,3,'jarukitsun@gmail.com',12);
INSERT INTO InventoryItem VALUES(118,1,'kidmortal@gmail.com',25);
INSERT INTO InventoryItem VALUES(119,1,'aenf2027@gmail.com',16);
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
INSERT INTO MarketListing VALUES(74,15,6,95,'paloma.santos@amopromo.com','2024-03-15T19:49:00.820+00:00','2024-03-16T11:27:34.618+00:00',NULL);
INSERT INTO MarketListing VALUES(75,18,7,96,'paloma.santos@amopromo.com','2024-03-15T19:49:11.937+00:00','2024-03-15T19:49:11.937+00:00',NULL);
INSERT INTO MarketListing VALUES(76,20,5,94,'paloma.santos@amopromo.com','2024-03-15T19:49:24.906+00:00','2024-03-16T00:43:42.952+00:00',NULL);
INSERT INTO MarketListing VALUES(77,25,15,46,'paloma.santos@amopromo.com','2024-03-15T19:49:40.606+00:00','2024-03-16T01:56:07.394+00:00',NULL);
INSERT INTO MarketListing VALUES(80,25,55,83,'paloma.santos@amopromo.com','2024-03-15T19:50:15.884+00:00','2024-03-15T19:50:15.884+00:00',NULL);
INSERT INTO MarketListing VALUES(81,8,209,93,'paloma.santos@amopromo.com','2024-03-15T19:50:26.721+00:00','2024-03-15T19:50:26.721+00:00',NULL);
INSERT INTO MarketListing VALUES(82,25,35,98,'paloma.santos@amopromo.com','2024-03-15T19:56:54.784+00:00','2024-03-15T20:22:46.097+00:00',NULL);
INSERT INTO MarketListing VALUES(83,25,25,97,'paloma.santos@amopromo.com','2024-03-15T19:57:04.566+00:00','2024-03-15T19:57:04.566+00:00',NULL);
INSERT INTO MarketListing VALUES(84,10,46,99,'paloma.santos@amopromo.com','2024-03-15T19:57:16.421+00:00','2024-03-15T19:57:16.421+00:00',NULL);
INSERT INTO MarketListing VALUES(85,5,1,116,'jarukitsun@gmail.com','2024-03-16T11:27:42.370+00:00','2024-03-16T11:27:42.370+00:00',NULL);
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
INSERT INTO User VALUES(1,'kidmortal@gmail.com','Kidmortal',2592,'true',1,10);
INSERT INTO User VALUES(6,'isaacalvesx7@gmail.com','Teste',30,0,NULL,NULL);
INSERT INTO User VALUES(8,'aenf2027@gmail.com','Catnip',20,0,2,NULL);
INSERT INTO User VALUES(10,'amanda96akiau@gmail.com','Amanda Akiau',893,0,2,NULL);
INSERT INTO User VALUES(13,'xxdennyxpvpxx@gmail.com','fala_dele',30,0,NULL,NULL);
INSERT INTO User VALUES(14,'paloma.santos@amopromo.com','Luazinha00',25214,0,2,NULL);
INSERT INTO User VALUES(15,'leoviggiano1@gmail.com','Jihuh',15,0,NULL,NULL);
INSERT INTO User VALUES(25,'leoslimaxv@gmail.com','Rarcelo Mossi',1462,0,2,NULL);
INSERT INTO User VALUES(26,'skoczencezary@gmail.com','Marcik',145,0,3,NULL);
INSERT INTO User VALUES(29,'jarukitsun@gmail.com','Sunshinezxc',180,0,5,NULL);
INSERT INTO User VALUES(30,'allan.oliveira@amopromo.com','Rafaela',20,0,3,10);
CREATE TABLE IF NOT EXISTS "LearnedSkill" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userEmail" TEXT NOT NULL,
    "skillId" INTEGER NOT NULL,
    "masteryLevel" INTEGER NOT NULL DEFAULT 1,
    "equipped" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "LearnedSkill_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LearnedSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO LearnedSkill VALUES(1,'kidmortal@gmail.com',1,1,1);
INSERT INTO LearnedSkill VALUES(2,'amanda96akiau@gmail.com',2,1,'true');
INSERT INTO LearnedSkill VALUES(3,'paloma.santos@amopromo.com',2,1,1);
INSERT INTO LearnedSkill VALUES(4,'kidmortal@gmail.com',2,1,1);
INSERT INTO LearnedSkill VALUES(5,'paloma.santos@amopromo.com',3,1,1);
INSERT INTO LearnedSkill VALUES(6,'aenf2027@gmail.com',5,1,'true');
INSERT INTO LearnedSkill VALUES(7,'aenf2027@gmail.com',6,1,'true');
INSERT INTO LearnedSkill VALUES(8,'kidmortal@gmail.com',4,1,1);
INSERT INTO LearnedSkill VALUES(12,'leoslimaxv@gmail.com',2,1,1);
INSERT INTO LearnedSkill VALUES(13,'leoslimaxv@gmail.com',3,1,1);
INSERT INTO LearnedSkill VALUES(14,'leoslimaxv@gmail.com',7,1,1);
INSERT INTO LearnedSkill VALUES(15,'paloma.santos@amopromo.com',7,1,1);
INSERT INTO LearnedSkill VALUES(16,'skoczencezary@gmail.com',5,1,1);
INSERT INTO LearnedSkill VALUES(17,'skoczencezary@gmail.com',6,1,1);
INSERT INTO LearnedSkill VALUES(18,'aenf2027@gmail.com',2,1,1);
INSERT INTO LearnedSkill VALUES(19,'aenf2027@gmail.com',3,1,1);
INSERT INTO LearnedSkill VALUES(20,'aenf2027@gmail.com',7,1,1);
INSERT INTO LearnedSkill VALUES(22,'jarukitsun@gmail.com',8,1,1);
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
