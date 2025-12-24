-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('IDLE', 'WORKING', 'PAUSED', 'COMPLETED', 'FAILED', 'STUCK');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('QUEUED', 'ASSIGNED', 'IN_PROGRESS', 'VERIFYING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "TaskComplexity" AS ENUM ('SIMPLE', 'MEDIUM', 'COMPLEX');

-- CreateEnum
CREATE TYPE "LogType" AS ENUM ('THINKING', 'TOOL_CALL', 'TOOL_RESULT', 'ERROR', 'STATUS_CHANGE', 'INFO');

-- CreateEnum
CREATE TYPE "ExceptionType" AS ENUM ('VERIFICATION_FAILED', 'AGENT_STUCK', 'CONFLICT_DETECTED', 'HIGH_RISK_CODE', 'UNKNOWN_ERROR');

-- CreateEnum
CREATE TYPE "ExceptionSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ExceptionStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "Agent" (
    "id" UUID NOT NULL,
    "name" TEXT,
    "status" "AgentStatus" NOT NULL DEFAULT 'IDLE',
    "currentTaskId" UUID,
    "branchName" TEXT,
    "conversationId" TEXT,
    "totalTokensUsed" INTEGER NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "tasksCompleted" INTEGER NOT NULL DEFAULT 0,
    "tasksFailed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL,
    "priority" SMALLINT NOT NULL DEFAULT 2,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "status" "TaskStatus" NOT NULL DEFAULT 'QUEUED',
    "assignedAgentId" UUID,
    "assignedAt" TIMESTAMP(3),
    "branchName" TEXT,
    "commitSha" VARCHAR(40),
    "prUrl" VARCHAR(500),
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verificationAttempts" INTEGER NOT NULL DEFAULT 0,
    "estimatedComplexity" "TaskComplexity",
    "filesHint" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileLock" (
    "id" UUID NOT NULL,
    "filePath" TEXT NOT NULL,
    "agentId" UUID NOT NULL,
    "taskId" UUID,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "FileLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationResult" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "confidenceScore" DECIMAL(3,2) NOT NULL,
    "syntaxPassed" BOOLEAN,
    "typesPassed" BOOLEAN,
    "lintPassed" BOOLEAN,
    "testsPassed" BOOLEAN,
    "testsTotal" INTEGER,
    "testsFailed" INTEGER,
    "semanticScore" DECIMAL(3,2),
    "semanticExplanation" TEXT,
    "failures" JSONB NOT NULL DEFAULT '[]',
    "recommendations" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentLog" (
    "id" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "taskId" UUID,
    "logType" "LogType" NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exception" (
    "id" UUID NOT NULL,
    "exceptionType" "ExceptionType" NOT NULL,
    "agentId" UUID,
    "taskId" UUID,
    "severity" "ExceptionSeverity" NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "suggestedAction" TEXT,
    "status" "ExceptionStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exception_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agent_currentTaskId_key" ON "Agent"("currentTaskId");

-- CreateIndex
CREATE INDEX "Agent_status_idx" ON "Agent"("status");

-- CreateIndex
CREATE INDEX "Agent_lastActivityAt_idx" ON "Agent"("lastActivityAt");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_priority_idx" ON "Task"("priority");

-- CreateIndex
CREATE INDEX "Task_assignedAgentId_idx" ON "Task"("assignedAgentId");

-- CreateIndex
CREATE INDEX "Task_createdAt_idx" ON "Task"("createdAt");

-- CreateIndex
CREATE INDEX "Task_status_priority_idx" ON "Task"("status", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "FileLock_filePath_key" ON "FileLock"("filePath");

-- CreateIndex
CREATE INDEX "FileLock_agentId_idx" ON "FileLock"("agentId");

-- CreateIndex
CREATE INDEX "FileLock_expiresAt_idx" ON "FileLock"("expiresAt");

-- CreateIndex
CREATE INDEX "VerificationResult_taskId_idx" ON "VerificationResult"("taskId");

-- CreateIndex
CREATE INDEX "VerificationResult_taskId_attemptNumber_idx" ON "VerificationResult"("taskId", "attemptNumber");

-- CreateIndex
CREATE INDEX "AgentLog_agentId_createdAt_idx" ON "AgentLog"("agentId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AgentLog_taskId_idx" ON "AgentLog"("taskId");

-- CreateIndex
CREATE INDEX "AgentLog_logType_idx" ON "AgentLog"("logType");

-- CreateIndex
CREATE INDEX "Exception_status_idx" ON "Exception"("status");

-- CreateIndex
CREATE INDEX "Exception_severity_idx" ON "Exception"("severity");

-- CreateIndex
CREATE INDEX "Exception_agentId_idx" ON "Exception"("agentId");

-- CreateIndex
CREATE INDEX "Exception_taskId_idx" ON "Exception"("taskId");

-- CreateIndex
CREATE INDEX "Exception_createdAt_idx" ON "Exception"("createdAt");

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_currentTaskId_fkey" FOREIGN KEY ("currentTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileLock" ADD CONSTRAINT "FileLock_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileLock" ADD CONSTRAINT "FileLock_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationResult" ADD CONSTRAINT "VerificationResult_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentLog" ADD CONSTRAINT "AgentLog_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentLog" ADD CONSTRAINT "AgentLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

