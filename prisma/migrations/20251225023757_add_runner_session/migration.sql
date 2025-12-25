-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "isLocalRunner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "runnerSessionId" UUID;

-- CreateTable
CREATE TABLE "RunnerSession" (
    "id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workingDir" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RunnerSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RunnerSession_token_key" ON "RunnerSession"("token");

-- CreateIndex
CREATE INDEX "RunnerSession_token_idx" ON "RunnerSession"("token");

-- CreateIndex
CREATE INDEX "RunnerSession_isActive_idx" ON "RunnerSession"("isActive");

-- CreateIndex
CREATE INDEX "RunnerSession_lastSeenAt_idx" ON "RunnerSession"("lastSeenAt");

-- CreateIndex
CREATE INDEX "Agent_runnerSessionId_idx" ON "Agent"("runnerSessionId");

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_runnerSessionId_fkey" FOREIGN KEY ("runnerSessionId") REFERENCES "RunnerSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
