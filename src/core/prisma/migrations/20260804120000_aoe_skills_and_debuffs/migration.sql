-- Area-of-effect skills and the debuff a skill can leave on a monster.
--
-- Debuffs are the enemy-side mirror of Buff. They only ever live for the length
-- of one fight, so nothing joins a monster to one here: the battle instance
-- holds the copy and the battle payload ships it to the client. The table is
-- only the catalogue a skill points at.
--
-- Everything already in the database keeps the behaviour it had: single target,
-- no debuff.

CREATE TABLE "Debuff" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "effect" TEXT NOT NULL DEFAULT 'none',
    "duration" INTEGER NOT NULL DEFAULT 2,
    "image" TEXT NOT NULL,
    "potency" INTEGER NOT NULL DEFAULT 0,
    "maxStack" INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX "Debuff_name_key" ON "Debuff"("name");

ALTER TABLE "Skill" ADD COLUMN "areaOfEffect" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Skill" ADD COLUMN "debuffId" INTEGER REFERENCES "Debuff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
