-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "classname" TEXT NOT NULL,
    "silver" INTEGER NOT NULL DEFAULT 20,
    "admin" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_User" ("classname", "email", "id", "name", "silver") SELECT "classname", "email", "id", "name", "silver" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
