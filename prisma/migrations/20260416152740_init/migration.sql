-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" INTEGER NOT NULL DEFAULT 50,
    "category" TEXT NOT NULL DEFAULT 'admin',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "sourceId" TEXT,
    "sourceUrl" TEXT,
    "sourceRef" TEXT,
    "dueDate" DATETIME,
    "scheduledFor" DATETIME,
    "isToday" BOOLEAN NOT NULL DEFAULT false,
    "daySlot" TEXT,
    "isFollowUp" BOOLEAN NOT NULL DEFAULT false,
    "followUpDate" DATETIME,
    "followUpContact" TEXT,
    "revenueImpact" TEXT,
    "effort" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "clientName" TEXT,
    "clientId" TEXT,
    "completedAt" DATETIME,
    "snoozedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EmailThread" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "threadId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "toEmails" TEXT NOT NULL,
    "snippet" TEXT,
    "lastMessageAt" DATETIME NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 1,
    "hasPendingReply" BOOLEAN NOT NULL DEFAULT false,
    "isRead" BOOLEAN NOT NULL DEFAULT true,
    "labels" TEXT NOT NULL DEFAULT '[]',
    "taskId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmailThread_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DayPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "nowTaskIds" TEXT NOT NULL DEFAULT '[]',
    "laterTaskIds" TEXT NOT NULL DEFAULT '[]',
    "skipTaskIds" TEXT NOT NULL DEFAULT '[]',
    "aiSummary" TEXT,
    "aiRecommendations" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "config" TEXT NOT NULL DEFAULT '{}',
    "lastSyncedAt" DATETIME,
    "lastSyncStatus" TEXT,
    "lastSyncMessage" TEXT,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FrankSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "briefing" TEXT,
    "recommendations" TEXT,
    "context" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailThread_threadId_key" ON "EmailThread"("threadId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailThread_taskId_key" ON "EmailThread"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "DayPlan_date_key" ON "DayPlan"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_type_key" ON "Integration"("type");
