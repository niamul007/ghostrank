-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "ScanRun" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "scored" BOOLEAN NOT NULL,
    "runNumber" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL,
    "answer" TEXT NOT NULL,
    "errorLabel" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScanRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScanRun_scanId_idx" ON "ScanRun"("scanId");

-- CreateIndex
CREATE UNIQUE INDEX "ScanRun_scanId_questionId_runNumber_key" ON "ScanRun"("scanId", "questionId", "runNumber");

-- AddForeignKey
ALTER TABLE "ScanRun" ADD CONSTRAINT "ScanRun_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

