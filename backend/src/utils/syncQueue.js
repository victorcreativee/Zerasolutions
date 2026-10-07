import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";

let storageReadyPromise;

export function isDesktopSyncEnabled() {
  return env.desktopMode && env.syncEnabled && Boolean(prisma.syncOperation);
}

export async function ensureSyncQueueStorage() {
  if (!isDesktopSyncEnabled()) {
    return;
  }

  if (!storageReadyPromise) {
    storageReadyPromise = createSyncQueueStorage();
  }

  await storageReadyPromise;
}

export async function enqueueSyncOperation({
  businessId,
  branchId,
  entityType,
  entityId,
  operation,
  method,
  endpoint,
  payload,
  userId
}) {
  if (!isDesktopSyncEnabled()) {
    return null;
  }

  try {
    await ensureSyncQueueStorage();

    return await prisma.syncOperation.create({
      data: {
        businessId: businessId || null,
        branchId: branchId || null,
        entityType,
        entityId: entityId || null,
        operation,
        method,
        endpoint,
        payload: payload || undefined,
        userId: userId || null
      }
    });
  } catch (error) {
    console.warn("Failed to queue offline sync operation:", error.message);
    return null;
  }
}

export async function getSyncStatus({ businessId } = {}) {
  if (!prisma.syncOperation) {
    return {
      desktopMode: env.desktopMode,
      configured: false,
      onlineTarget: "",
      counts: emptyCounts(),
      lastSyncedAt: null
    };
  }

  try {
    await ensureSyncQueueStorage();

    const where = businessId ? { businessId } : {};
    const [groups, lastSynced] = await Promise.all([
      prisma.syncOperation.groupBy({
        by: ["status"],
        where,
        _count: { _all: true }
      }),
      prisma.syncOperation.findFirst({
        where: {
          ...where,
          status: "SYNCED",
          syncedAt: {
            not: null
          }
        },
        orderBy: { syncedAt: "desc" },
        select: { syncedAt: true }
      })
    ]);

    const counts = emptyCounts();
    groups.forEach((group) => {
      counts[group.status] = group._count._all;
    });

    return {
      desktopMode: env.desktopMode,
      configured: Boolean(env.syncServerUrl),
      onlineTarget: env.syncServerUrl,
      counts,
      lastSyncedAt: lastSynced?.syncedAt || null
    };
  } catch (error) {
    console.warn("Failed to read offline sync status:", error.message);

    return {
      desktopMode: env.desktopMode,
      configured: false,
      onlineTarget: env.syncServerUrl,
      counts: emptyCounts(),
      lastSyncedAt: null
    };
  }
}

export async function listSyncOperations({ businessId, status, limit = 50 } = {}) {
  if (!prisma.syncOperation) {
    return [];
  }

  try {
    await ensureSyncQueueStorage();

    return prisma.syncOperation.findMany({
      where: {
        ...(businessId ? { businessId } : {}),
        ...(status ? { status } : {})
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(Number(limit) || 50, 100)
    });
  } catch (error) {
    console.warn("Failed to list offline sync operations:", error.message);
    return [];
  }
}

export async function prepareSyncRun({ businessId } = {}) {
  const status = await getSyncStatus({ businessId });

  return {
    status,
    message: status.configured
      ? "Online sync target is configured. Secure cloud replay will be enabled from the server sync connector."
      : "Online sync target is not configured for this desktop build yet.",
    prepared: false
  };
}

function emptyCounts() {
  return {
    PENDING: 0,
    SYNCING: 0,
    SYNCED: 0,
    FAILED: 0
  };
}

async function createSyncQueueStorage() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS "SyncOperation" (
      "id" TEXT NOT NULL,
      "businessId" TEXT,
      "branchId" TEXT,
      "entityType" TEXT NOT NULL,
      "entityId" TEXT,
      "operation" TEXT NOT NULL,
      "method" TEXT NOT NULL,
      "endpoint" TEXT NOT NULL,
      "payload" JSONB,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "source" TEXT NOT NULL DEFAULT 'desktop',
      "attempts" INTEGER NOT NULL DEFAULT 0,
      "lastError" TEXT,
      "nextAttemptAt" TIMESTAMP(3),
      "syncedAt" TIMESTAMP(3),
      "userId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "SyncOperation_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE INDEX IF NOT EXISTS "SyncOperation_businessId_idx" ON "SyncOperation"("businessId")`,
    `CREATE INDEX IF NOT EXISTS "SyncOperation_branchId_idx" ON "SyncOperation"("branchId")`,
    `CREATE INDEX IF NOT EXISTS "SyncOperation_status_idx" ON "SyncOperation"("status")`,
    `CREATE INDEX IF NOT EXISTS "SyncOperation_entityType_idx" ON "SyncOperation"("entityType")`,
    `CREATE INDEX IF NOT EXISTS "SyncOperation_createdAt_idx" ON "SyncOperation"("createdAt")`
  ];

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
}
