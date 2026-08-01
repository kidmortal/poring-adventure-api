-- Crafters can sell their stamina: a hirer pays silver per stamina point and the
-- crafter does the work. Only professions flagged canEnhance (Blacksmithing)
-- may sell the enhancing service.

ALTER TABLE "Profession" ADD COLUMN "canEnhance" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Profession" SET "canEnhance" = true WHERE "name" = 'Blacksmithing';

CREATE TABLE "ServiceOffer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "crafterEmail" TEXT NOT NULL,
    "professionId" INTEGER NOT NULL,
    "pricePerStamina" INTEGER NOT NULL DEFAULT 50,
    "crafting" BOOLEAN NOT NULL DEFAULT true,
    "enhancing" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceOffer_crafterEmail_fkey" FOREIGN KEY ("crafterEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServiceOffer_professionId_fkey" FOREIGN KEY ("professionId") REFERENCES "Profession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ServiceOffer_crafterEmail_key" ON "ServiceOffer"("crafterEmail");
