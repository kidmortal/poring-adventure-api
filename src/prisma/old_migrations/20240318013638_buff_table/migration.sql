-- CreateTable
CREATE TABLE "UserBuff" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "buffId" INTEGER NOT NULL,
    "userId" INTEGER,
    "duration" INTEGER NOT NULL,
    CONSTRAINT "UserBuff_buffId_fkey" FOREIGN KEY ("buffId") REFERENCES "Buff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserBuff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Buff" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "image" TEXT NOT NULL,
    "pose" TEXT NOT NULL DEFAULT 'default',
    "persist" BOOLEAN NOT NULL DEFAULT false,
    "maxStack" INTEGER NOT NULL DEFAULT 1
);

-- CreateIndex
CREATE UNIQUE INDEX "Buff_name_key" ON "Buff"("name");
