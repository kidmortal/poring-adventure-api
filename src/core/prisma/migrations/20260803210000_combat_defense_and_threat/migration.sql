-- Phase 1 of the combat plan: the four columns a trinity needs.
--
-- `defense` gives a tank something to be other than a bigger health bar, and
-- `threatModifier` splits threat away from damage so the class with the lowest
-- attack can still be the one the boss is looking at.
--
-- Everything already in the database defaults to the behaviour it had before:
-- no mitigation, threat equal to damage, and a monster whose speed falls back
-- to its level.

ALTER TABLE "Stats" ADD COLUMN "defense" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Class" ADD COLUMN "defense" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Item" ADD COLUMN "defense" INTEGER;
ALTER TABLE "Monster" ADD COLUMN "agi" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Monster" ADD COLUMN "defense" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Skill" ADD COLUMN "threatModifier" REAL NOT NULL DEFAULT 1;
