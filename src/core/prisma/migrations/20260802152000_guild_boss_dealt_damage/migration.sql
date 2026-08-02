-- AlterTable
ALTER TABLE "GuildBossDamage" ADD COLUMN "dealtDamage" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GuildBossDamage" ADD COLUMN "partyLeaderEmail" TEXT;

-- Rows banked before the split was recorded have only the one number, so it
-- stands in for both rather than showing everyone as having dealt nothing.
UPDATE "GuildBossDamage" SET "dealtDamage" = "damage" WHERE "dealtDamage" = 0;
