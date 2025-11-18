import { HttpError } from 'wasp/server';
import { throwIfNotAdmin } from '../../utils/auth/server';

/**
 * Get audit logs for a specific user
 */
export const getAuditLogsByUser = async (args: { userId: number }, context: any) => {
  throwIfNotAdmin(context.user);

  const { userId } = args;

  // Get audit logs with related user and entity information
  const auditLogs = await context.entities.AuditEvent.findMany({
    where: {
      actorUserId: userId,
    },
    include: {
      actorUser: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
    orderBy: {
      eventTimestamp: 'desc',
    },
    take: 100, // Limit to last 100 events
  });

  return auditLogs;
};

/**
 * Get recent audit logs (all users)
 */
export const getRecentAuditLogs = async (args: any, context: any) => {
  throwIfNotAdmin(context.user);

  const auditLogs = await context.entities.AuditEvent.findMany({
    include: {
      actorUser: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
    orderBy: {
      eventTimestamp: 'desc',
    },
    take: 50, // Last 50 events
  });

  return auditLogs;
};

/**
 * Get audit logs for a specific entity
 */
export const getAuditLogsByEntity = async (
  args: { entityType: string; entityId: number },
  context: any
) => {
  throwIfNotAdmin(context.user);

  const { entityType, entityId } = args;

  const auditLogs = await context.entities.AuditEvent.findMany({
    where: {
      entityType,
      entityId,
    },
    include: {
      actorUser: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
    orderBy: {
      eventTimestamp: 'desc',
    },
  });

  return auditLogs;
};
