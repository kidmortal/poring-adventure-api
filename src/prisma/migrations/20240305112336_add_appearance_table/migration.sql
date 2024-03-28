-- CreateTable
CREATE TABLE "Appearance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "head" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "costume" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    CONSTRAINT "Appearance_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Appearance_userEmail_key" ON "Appearance"("userEmail");
