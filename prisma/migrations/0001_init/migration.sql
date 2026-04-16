CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" INTEGER NOT NULL DEFAULT 50,
    "category" TEXT NOT NULL DEFAULT 'admin',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "sourceId" TEXT,
    "sourceUrl" TEXT,
    "sourceRef" TEXT,
    "dueDate" TIMESTAMP(3),
    "scheduledFor" TIMESTAMP(3),
    "isToday" BOOLEAN NOT NULL DEFAULT false,
    "daySlot" TEXT,
    "isFollowUp" BOOLEAN NOT NULL DEFAULT false,
    "followUpDate" TIMESTAMP(3),
    "followUpContact" TEXT,
    "revenueImpact" TEXT,
    "effort" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "clientName" TEXT,
    "clientId" TEXT,
    "completedAt" TIMESTAMP(3),
    "snoozedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailThread" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "toEmails" TEXT NOT NULL,
    "snippet" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 1,
    "hasPendingReply" BOOLEAN NOT NULL DEFAULT false,
    "isRead" BOOLEAN NOT NULL DEFAULT true,
    "labels" TEXT NOT NULL DEFAULT '[]',
    "taskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DayPlan" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "nowTaskIds" TEXT NOT NULL DEFAULT '[]',
    "laterTaskIds" TEXT NOT NULL DEFAULT '[]',
    "skipTaskIds" TEXT NOT NULL DEFAULT '[]',
    "aiSummary" TEXT,
    "aiRecommendations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DayPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "config" TEXT NOT NULL DEFAULT '{}',
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncMessage" TEXT,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FrankSession" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "briefing" TEXT,
    "recommendations" TEXT,
    "context" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FrankSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

CREATE UNIQUE INDEX "EmailThread_threadId_key" ON "EmailThread"("threadId");
CREATE UNIQUE INDEX "EmailThread_taskId_key" ON "EmailThread"("taskId");
CREATE UNIQUE INDEX "DayPlan_date_key" ON "DayPlan"("date");
CREATE UNIQUE INDEX "Integration_type_key" ON "Integration"("type");

ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
