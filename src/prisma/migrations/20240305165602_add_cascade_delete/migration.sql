-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Appearance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "head" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "costume" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    CONSTRAINT "Appearance_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Appearance" ("costume", "gender", "head", "id", "userEmail") SELECT "costume", "gender", "head", "id", "userEmail" FROM "Appearance";
DROP TABLE "Appearance";
ALTER TABLE "new_Appearance" RENAME TO "Appearance";
CREATE UNIQUE INDEX "Appearance_userEmail_key" ON "Appearance"("userEmail");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
