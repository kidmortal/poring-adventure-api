-- The crafting economy revamp.
--
-- Cooking stops healing and starts buffing, so a consumable can now carry a
-- buff, say whether it may be used mid-fight, and whether it feeds the whole
-- party. The buff itself gains the two percentages the "well_fed" effect reads,
-- kept as columns so a new meal is a seed row rather than new code.
--
-- The commission board is the demand engine: a standing NPC contract per item,
-- and a per-player per-day record of which were offered and which were filled.

ALTER TABLE "Item" ADD COLUMN "buffId" INTEGER REFERENCES "Buff" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Item" ADD COLUMN "battleUse" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Item" ADD COLUMN "partyWide" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Item" ADD COLUMN "battleEffect" TEXT;

ALTER TABLE "Buff" ADD COLUMN "attackBonus" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Buff" ADD COLUMN "healthBonus" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "Commission" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "itemId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 1,
    "silver" INTEGER NOT NULL,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "requiredLevel" INTEGER NOT NULL DEFAULT 1,
    "professionId" INTEGER NOT NULL,
    CONSTRAINT "Commission_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Commission_professionId_fkey" FOREIGN KEY ("professionId") REFERENCES "Profession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- The profession belongs in the key: a cook and a fisherman can both be asked
-- for six raw fish, and those are two different contracts.
CREATE UNIQUE INDEX "Commission_professionId_itemId_amount_key" ON "Commission" ("professionId", "itemId", "amount");

CREATE TABLE "UserCommission" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userEmail" TEXT NOT NULL,
    "commissionId" INTEGER NOT NULL,
    "deliveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "offeredOn" TEXT NOT NULL,
    CONSTRAINT "UserCommission_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserCommission_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "Commission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "UserCommission_userEmail_commissionId_offeredOn_key" ON "UserCommission" ("userEmail", "commissionId", "offeredOn");
