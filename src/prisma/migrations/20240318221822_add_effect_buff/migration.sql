-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Buff" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "effect" TEXT NOT NULL DEFAULT 'none',
    "duration" INTEGER NOT NULL,
    "image" TEXT NOT NULL,
    "pose" TEXT NOT NULL DEFAULT 'default',
    "persist" BOOLEAN NOT NULL DEFAULT false,
    "maxStack" INTEGER NOT NULL DEFAULT 1
);
INSERT INTO "new_Buff" ("duration", "id", "image", "maxStack", "name", "persist", "pose") SELECT "duration", "id", "image", "maxStack", "name", "persist", "pose" FROM "Buff";
DROP TABLE "Buff";
ALTER TABLE "new_Buff" RENAME TO "Buff";
CREATE UNIQUE INDEX "Buff_name_key" ON "Buff"("name");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
