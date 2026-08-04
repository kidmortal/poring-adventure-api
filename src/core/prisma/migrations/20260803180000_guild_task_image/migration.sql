-- A guild task now carries its own sprite.
--
-- The offer was illustrated with the target map's image, and a map's image is
-- its boss — so "Poring infestation", a task to kill a hundred porings, showed
-- a King Poring. Existing rows keep the empty default and fall back to the map
-- image, which is what they were already doing.

ALTER TABLE "GuildTask" ADD COLUMN "image" TEXT NOT NULL DEFAULT '';
