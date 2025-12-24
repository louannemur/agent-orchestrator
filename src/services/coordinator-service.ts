import { db } from "@/lib/db";
import type { FileLock } from "@/types";

// ============================================================================
// CoordinatorService Class
// ============================================================================

class CoordinatorService {
  // Default lock expiration time (1 hour)
  private readonly DEFAULT_LOCK_DURATION_MS = 60 * 60 * 1000;

  // ==========================================================================
  // Lock Acquisition
  // ==========================================================================

  async acquireLock(
    agentId: string,
    taskId: string,
    filePath: string,
    durationMs?: number
  ): Promise<boolean> {
    const normalizedPath = this.normalizePath(filePath);

    try {
      // Check if file is already locked
      const existingLock = await db.fileLock.findUnique({
        where: { filePath: normalizedPath },
      });

      if (existingLock) {
        // If locked by the same agent, it's idempotent - return success
        if (existingLock.agentId === agentId) {
          return true;
        }

        // Check if the lock has expired
        if (existingLock.expiresAt && existingLock.expiresAt < new Date()) {
          // Lock expired, delete it and proceed
          await db.fileLock.delete({
            where: { id: existingLock.id },
          });
        } else {
          // Lock held by another agent and not expired
          return false;
        }
      }

      // Create new lock
      const expiresAt = new Date(
        Date.now() + (durationMs ?? this.DEFAULT_LOCK_DURATION_MS)
      );

      await db.fileLock.create({
        data: {
          filePath: normalizedPath,
          agentId,
          taskId,
          expiresAt,
        },
      });

      return true;
    } catch (error) {
      // Handle race condition - unique constraint violation means another agent got the lock
      if (
        error instanceof Error &&
        error.message.includes("Unique constraint")
      ) {
        return false;
      }
      console.error("[CoordinatorService] acquireLock error:", error);
      return false;
    }
  }

  async acquireLocks(
    agentId: string,
    taskId: string,
    filePaths: string[]
  ): Promise<{ acquired: string[]; failed: string[] }> {
    const acquired: string[] = [];
    const failed: string[] = [];

    // Try to acquire all locks
    for (const filePath of filePaths) {
      const success = await this.acquireLock(agentId, taskId, filePath);
      if (success) {
        acquired.push(filePath);
      } else {
        failed.push(filePath);
      }
    }

    // If any failed, release all acquired (atomic operation)
    if (failed.length > 0 && acquired.length > 0) {
      for (const filePath of acquired) {
        await this.releaseLock(agentId, filePath);
      }
      return { acquired: [], failed: [...acquired, ...failed] };
    }

    return { acquired, failed };
  }

  // ==========================================================================
  // Lock Release
  // ==========================================================================

  async releaseLock(agentId: string, filePath: string): Promise<void> {
    const normalizedPath = this.normalizePath(filePath);

    try {
      await db.fileLock.deleteMany({
        where: {
          filePath: normalizedPath,
          agentId,
        },
      });
    } catch (error) {
      console.error("[CoordinatorService] releaseLock error:", error);
    }
  }

  async releaseAllLocks(agentId: string): Promise<void> {
    try {
      const result = await db.fileLock.deleteMany({
        where: { agentId },
      });

      if (result.count > 0) {
        console.log(
          `[CoordinatorService] Released ${result.count} locks for agent ${agentId}`
        );
      }
    } catch (error) {
      console.error("[CoordinatorService] releaseAllLocks error:", error);
    }
  }

  // ==========================================================================
  // Lock Queries
  // ==========================================================================

  async getLocksForAgent(agentId: string): Promise<FileLock[]> {
    return db.fileLock.findMany({
      where: { agentId },
      orderBy: { acquiredAt: "desc" },
    });
  }

  async getLocksForFile(filePath: string): Promise<FileLock | null> {
    const normalizedPath = this.normalizePath(filePath);

    const lock = await db.fileLock.findUnique({
      where: { filePath: normalizedPath },
    });

    // Check if expired
    if (lock && lock.expiresAt && lock.expiresAt < new Date()) {
      await db.fileLock.delete({ where: { id: lock.id } });
      return null;
    }

    return lock;
  }

  async isFileLocked(filePath: string, excludeAgentId?: string): Promise<boolean> {
    const normalizedPath = this.normalizePath(filePath);

    const lock = await db.fileLock.findUnique({
      where: { filePath: normalizedPath },
    });

    if (!lock) return false;

    // Check if expired
    if (lock.expiresAt && lock.expiresAt < new Date()) {
      await db.fileLock.delete({ where: { id: lock.id } });
      return false;
    }

    // Exclude specific agent if requested
    if (excludeAgentId && lock.agentId === excludeAgentId) {
      return false;
    }

    return true;
  }

  // ==========================================================================
  // Cleanup & Maintenance
  // ==========================================================================

  async cleanupExpiredLocks(): Promise<number> {
    const now = new Date();

    const result = await db.fileLock.deleteMany({
      where: {
        expiresAt: { lt: now },
      },
    });

    if (result.count > 0) {
      console.log(
        `[CoordinatorService] Cleaned up ${result.count} expired locks`
      );
    }

    return result.count;
  }

  // ==========================================================================
  // Conflict Detection
  // ==========================================================================

  async checkForConflicts(
    taskId: string,
    predictedFiles: string[]
  ): Promise<string[]> {
    const conflicts: string[] = [];

    // Get the task to find its agent
    const task = await db.task.findUnique({
      where: { id: taskId },
      select: { assignedAgentId: true },
    });

    const agentId = task?.assignedAgentId;

    for (const filePath of predictedFiles) {
      const isLocked = await this.isFileLocked(
        filePath,
        agentId ?? undefined
      );
      if (isLocked) {
        conflicts.push(filePath);
      }
    }

    return conflicts;
  }

  async getConflictingTasks(filePaths: string[]): Promise<
    Array<{
      filePath: string;
      lock: FileLock;
    }>
  > {
    const conflicts: Array<{ filePath: string; lock: FileLock }> = [];

    for (const filePath of filePaths) {
      const lock = await this.getLocksForFile(filePath);
      if (lock) {
        conflicts.push({ filePath, lock });
      }
    }

    return conflicts;
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private normalizePath(filePath: string): string {
    // Normalize path separators and remove trailing slashes
    return filePath
      .replace(/\\/g, "/")
      .replace(/\/+/g, "/")
      .replace(/\/$/, "");
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const coordinatorService = new CoordinatorService();

// Re-export class for testing
export { CoordinatorService };
