-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Skill" (
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
INSERT INTO "new_Skill" ("attribute", "id", "image", "multiplier", "name", "professionId", "requiredLevel") SELECT "attribute", "id", "image", "multiplier", "name", "professionId", "requiredLevel" FROM "Skill";
DROP TABLE "Skill";
ALTER TABLE "new_Skill" RENAME TO "Skill";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
