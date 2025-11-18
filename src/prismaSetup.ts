/**
 * Prisma Client Setup with Delete Blocking and Audit Logging
 *
 * This setup function is called by Wasp during server initialization.
 * It extends the Prisma client to:
 * 1. Block delete operations on healthcare data
 * 2. Automatically log all CREATE and UPDATE operations for audit trail
 *
 * Healthcare Compliance:
 * - Patient data and medical records cannot be deleted
 * - All data modifications are tracked with user attribution
 *
 * Whitelisted tables for deletion:
 * - Slot: Availability windows can be deleted ONLY if no consultation is assigned
 *
 * All other tables (Patient, Consultation, ConsultationRequest, etc.) are protected.
 */

import { PrismaClient } from '@prisma/client';
import {
  shouldAudit,
  validateAuditUserId,
  extractAndRemoveAuditUserId,
  logPrismaOperation,
  getChangedFieldsFromArgs
} from './utils/audit';

const HEALTHCARE_DELETE_ERROR =
  'DELETE operations are disabled in this application. ' +
  'This is a healthcare application - data cannot be deleted. ' +
  'If you need to remove records, implement soft deletes instead.';

/**
 * Checks if a Slot can be safely deleted (must not have a consultation)
 */
async function checkSlotDeletion(baseClient: PrismaClient, args: any) {
  const slot = await baseClient.slot.findUnique({
    where: args.where,
    select: { id: true, consultation: { select: { id: true } } }
  });

  const hasConsultation =
    slot?.consultation !== undefined
    && slot?.consultation !== null;

  if (hasConsultation) {
    throw new Error(
      'Cannot delete a slot that has a consultation assigned. ' +
      'This slot is part of a medical record and must be preserved.'
    );
  }
}

/**
 * Checks if a bulk Slot deletion includes the required consultation filter
 */
function checkBulkSlotDeletion(args: any) {
  const hasWhereClause = args.where !== undefined && args.where !== null;
  const hasConsultationFilter = hasWhereClause && 'consultation' in args.where;

  if (!hasConsultationFilter) {
    throw new Error(
      'Bulk Slot deletions must explicitly filter out slots with consultations. ' +
      'Add "consultation: null" to your where clause.'
    );
  }
}

// Note: Audit configuration and utilities are now in ./utils/audit.ts

export const setupPrisma = () => {
  const baseClient = new PrismaClient();

  const prisma = baseClient.$extends({
    query: {
      $allModels: {
        // Audit CREATE operations
        async create({ model, args, query }) {
          if (!shouldAudit(model)) {
            return query(args);
          }

          const userId = extractAndRemoveAuditUserId(args);
          validateAuditUserId(model, 'create', userId);

          const result = await query(args);

          const recordId = (result as any)?.id;
          if (recordId) {
            const changedFields = args.data ? { changes: args.data } : null;
            logPrismaOperation(baseClient, userId, 'CREATE', model, recordId, changedFields);
          }

          return result;
        },

        // Audit UPDATE operations
        async update({ model, args, query }) {
          if (!shouldAudit(model)) {
            return query(args);
          }

          const userId = extractAndRemoveAuditUserId(args);
          validateAuditUserId(model, 'update', userId);

          const result = await query(args);

          const recordId = (result as any)?.id;
          if (recordId) {
            const changedFields = getChangedFieldsFromArgs(args, 'update');
            logPrismaOperation(baseClient, userId, 'UPDATE', model, recordId, changedFields);
          }

          return result;
        },

        // Audit UPSERT operations
        async upsert({ model, args, query }) {
          if (!shouldAudit(model)) {
            return query(args);
          }

          const userId = extractAndRemoveAuditUserId(args);
          validateAuditUserId(model, 'upsert', userId);

          const result = await query(args);

          const recordId = (result as any)?.id;
          if (recordId) {
            const changedFields = getChangedFieldsFromArgs(args, 'upsert');
            logPrismaOperation(baseClient, userId, 'UPDATE', model, recordId, changedFields);
          }

          return result;
        },

        // Block DELETE operations
        async delete({ model, args, query }) {
          if (model === 'Slot') {
            await checkSlotDeletion(baseClient, args);
            return query(args);
          }

          throw new Error(HEALTHCARE_DELETE_ERROR);
        },

        // Block DELETE MANY operations
        async deleteMany({ model, args, query }) {
          if (model === 'Slot') {
            checkBulkSlotDeletion(args);
            return query(args);
          }

          throw new Error(HEALTHCARE_DELETE_ERROR);
        },
      },
    },
  });

  console.log('✅ Prisma extensions enabled:');
  console.log('   - Delete-blocking (Slot deletions allowed with safety checks)');
  console.log('   - Audit logging (CREATE/UPDATE operations tracked)');

  return prisma;
};
