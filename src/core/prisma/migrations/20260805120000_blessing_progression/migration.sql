-- Blessings that cost more the further they go, and four more of them.
--
-- A blessing used to cost 100 soulshards a level for ever, so the twentieth was
-- as cheap as the first and a mature guild's shard income stopped being a
-- decision. The cost now compounds a third again per level and stops at level
-- 20, which is what makes spreading levels across the blessings the members
-- actually use a different plan from pushing one of them alone.
--
-- Defense, crit rate and crit damage join the sheet the combat rebuild gave
-- everyone. Stamina is the odd one out: it buys daily profession stamina
-- rather than a combat stat, so a guild is finally worth joining for someone
-- who only crafts.
--
-- Stats.bonusMaxStamina remembers how much of a player's ceiling the guild
-- bought. Levelling a trade recomputes maxStamina from that trade's level, and
-- without somewhere to keep the blessing that recompute would spend it.
--
-- The blessing table is rebuilt rather than altered because the old columns
-- defaulted to 5/5/1/1/1 — stats that were advertised on the guild page and
-- never written onto a single member's sheet. New guilds now start every
-- blessing at 0, which is what they always effectively had. Existing rows are
-- carried over untouched, so no guild loses a level it paid for.

ALTER TABLE "Stats" ADD COLUMN "bonusMaxStamina" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "new_GuildBlessing" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" INTEGER NOT NULL,
    "health" INTEGER NOT NULL DEFAULT 0,
    "mana" INTEGER NOT NULL DEFAULT 0,
    "str" INTEGER NOT NULL DEFAULT 0,
    "int" INTEGER NOT NULL DEFAULT 0,
    "agi" INTEGER NOT NULL DEFAULT 0,
    "defense" INTEGER NOT NULL DEFAULT 0,
    "critRate" INTEGER NOT NULL DEFAULT 0,
    "critDamage" INTEGER NOT NULL DEFAULT 0,
    "stamina" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "GuildBlessing_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_GuildBlessing" ("id", "guildId", "health", "mana", "str", "int", "agi")
SELECT "id", "guildId", "health", "mana", "str", "int", "agi" FROM "GuildBlessing";

DROP TABLE "GuildBlessing";
ALTER TABLE "new_GuildBlessing" RENAME TO "GuildBlessing";
CREATE UNIQUE INDEX "GuildBlessing_guildId_key" ON "GuildBlessing"("guildId");
