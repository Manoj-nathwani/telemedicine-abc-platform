/**
 * Audit Logging Utilities
 *
 * This module contains all audit-related logic:
 * 1. Audit configuration and validation (for Prisma extensions)
 * 2. Automatic audit logging (for Prisma operations)
 * 3. Manual audit logging (for transactions)
 */

// ============================================================================
// Audit Configuration
// ============================================================================

/**
 * Models excluded from audit logging
 * - AuditEvent: Prevent recursive audit logging
 * - Session, Auth, AuthIdentity: Wasp auth internals (not healthcare data)
 */
export const AUDIT_EXCLUDED_MODELS = ['AuditEvent', 'Session', 'Auth', 'AuthIdentity'];

export type AuditEventType = 'CREATE' | 'UPDATE' | 'DELETE';

type AuditChangedFields = {
  changes: Record<string, any>;
};

// ============================================================================
// Audit Validation (for Prisma extension)
// ============================================================================

/**
 * Check if a model should be audited
 */
export function shouldAudit(model: string): boolean {
  return !AUDIT_EXCLUDED_MODELS.includes(model);
}

/**
 * Validate that __auditUserId is present and valid
 */
export function validateAuditUserId(model: string, operation: string, userId: any): void {
  if (userId === undefined || userId === null || userId === 0) {
    throw new Error(
      `__auditUserId is required for ${model}.${operation}() operation. ` +
      `Use context.user.id for user operations, or SMS_SERVICE_USER.id for SMS API.`
    );
  }
}

/**
 * Extract __auditUserId from args and remove it
 * (Prisma doesn't know about this custom field)
 */
export function extractAndRemoveAuditUserId(args: any): number {
  const userId = args.__auditUserId;
  delete args.__auditUserId;
  return userId;
}

// ============================================================================
// Audit Logging (for Prisma extension - fire-and-forget)
// ============================================================================

/**
 * Log a Prisma operation to the audit trail
 * This is fire-and-forget - errors are logged but don't block operations
 */
export async function logPrismaOperation(
  baseClient: any, // PrismaClient
  userId: number,
  eventType: AuditEventType,
  model: string,
  recordId: number,
  changedFields?: AuditChangedFields | null
): Promise<void> {
  try {
    const data: any = {
      actorUserId: userId,
      eventType,
      entityType: model,
      entityId: recordId,
    };

    if (changedFields) {
      data.changedFields = changedFields;
    }

    // Fire-and-forget - don't await, catch errors internally
    baseClient.auditEvent.create({ data }).catch((error: any) => {
      console.error('Failed to create audit log:', error);
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}

/**
 * Extract changed fields from Prisma args for audit logging
 */
export function getChangedFieldsFromArgs(args: any, operation: 'update' | 'upsert'): AuditChangedFields | null {
  if (operation === 'update' && args.data) {
    return { changes: args.data };
  }
  if (operation === 'upsert' && args.update) {
    return { changes: args.update };
  }
  return null;
}

// ============================================================================
// Manual Audit Logging (for transactions that bypass Prisma extension)
// ============================================================================

interface AuditContext {
  entities: {
    AuditEvent: any;
  };
}

/**
 * Create a single audit log entry
 * Note: AuditEvent is excluded from audit extension, so we can use context.entities directly
 */
export async function createAuditLog(
  context: AuditContext,
  userId: number,
  eventType: AuditEventType,
  entityType: string,
  entityId: number,
  changedFields?: Record<string, any>
) {
  const data: any = {
    actorUserId: userId,
    eventType,
    entityType,
    entityId
  };

  if (changedFields) {
    data.changedFields = { changes: changedFields };
  }

  try {
    // AuditEvent is in AUDIT_EXCLUDED_MODELS, so this won't trigger recursion
    await context.entities.AuditEvent.create({ data });
  } catch (error) {
    // Log error but don't fail the operation
    console.error(`❌ Failed to create audit log for ${entityType}#${entityId}:`, error);
    console.error('Audit data was:', JSON.stringify(data, null, 2));
  }
}

/**
 * Create multiple audit log entries in one call
 * Useful after transactions that create/update multiple entities
 */
export async function createAuditLogs(
  context: AuditContext,
  userId: number,
  entries: Array<{
    eventType: AuditEventType;
    entityType: string;
    entityId: number;
    changedFields?: Record<string, any>;
  }>
) {
  await Promise.all(
    entries.map(entry =>
      createAuditLog(
        context,
        userId,
        entry.eventType,
        entry.entityType,
        entry.entityId,
        entry.changedFields
      )
    )
  );
}
