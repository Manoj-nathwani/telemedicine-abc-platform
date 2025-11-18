/**
 * Comprehensive Audit Logging Test
 *
 * This test creates a User and makes multiple changes to it by different users,
 * then verifies that all changes are properly logged in the audit trail.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { waspOp, loginUser, setUserPassword, setupTests, cleanupTestData } from './helpers/wasp.js';
import { generateTestEmail } from './helpers/fixtures.js';

let seededAdminSessionId = '';
let adminSessionId = '';
let adminEmail = '';
let testUserId;

beforeAll(async () => {
  await setupTests();
  await cleanupTestData();

  // Login as seeded admin
  seededAdminSessionId = await loginUser(process.env.ADMIN_EMAIL, process.env.ADMIN_EMAIL);
  adminSessionId = seededAdminSessionId;

  // Create an admin user for testing
  adminEmail = generateTestEmail('audit-admin');
  await waspOp('create-user', {
    name: 'Audit Test Admin',
    email: adminEmail,
    role: 'admin'
  }, seededAdminSessionId);
  await setUserPassword(adminEmail, 'password123');
  adminSessionId = await loginUser(adminEmail, 'password123');
});

afterAll(async () => {
  await cleanupTestData();
});

describe('Comprehensive Audit Logging', () => {
  it('should track complete lifecycle of a User with multiple changes by different actors', async () => {
    // ========================================
    // 1. CREATE: Seeded admin creates a new user
    // ========================================
    const createResponse = await waspOp('create-user', {
      name: 'Dr. Audit Test',
      email: 'audit.test@example.com',
      role: 'clinician'
    }, seededAdminSessionId);

    expect(createResponse.status).toBe(200);
    testUserId = createResponse.body.json.id;

    // Wait for audit log
    await new Promise(resolve => setTimeout(resolve, 300));

    // ========================================
    // 2. UPDATE #1: Seeded admin changes role to admin
    // ========================================
    const update1Response = await waspOp('update-user-role', {
      userId: testUserId,
      role: 'admin'
    }, seededAdminSessionId);

    expect(update1Response.status).toBe(200);
    await new Promise(resolve => setTimeout(resolve, 300));

    // ========================================
    // 3. UPDATE #2: Admin changes role back to clinician
    // ========================================
    const update2Response = await waspOp('update-user-role', {
      userId: testUserId,
      role: 'clinician'
    }, adminSessionId);

    expect(update2Response.status).toBe(200);
    await new Promise(resolve => setTimeout(resolve, 300));

    // ========================================
    // 4. UPDATE #3: Seeded admin changes role to admin again
    // ========================================
    const update3Response = await waspOp('update-user-role', {
      userId: testUserId,
      role: 'admin'
    }, seededAdminSessionId);

    expect(update3Response.status).toBe(200);
    await new Promise(resolve => setTimeout(resolve, 300));

    // ========================================
    // VERIFY: Check all audit logs
    // ========================================
    const auditLogsResponse = await waspOp('get-audit-logs-by-entity', {
      entityType: 'User',
      entityId: testUserId
    }, adminSessionId);

    expect(auditLogsResponse.status).toBe(200);
    const logs = auditLogsResponse.body.json;

    logs.forEach((log, index) => {
      // Verify log structure
      expect(log).toHaveProperty('eventType');
      expect(log).toHaveProperty('actorUser');
      expect(log).toHaveProperty('eventTimestamp');
      if (log.changedFields) {
        expect(log.changedFields).toHaveProperty('changes');
      }
    });

    // Should have exactly 4 logs: 1 CREATE + 3 UPDATEs
    expect(logs.length).toBe(4);

    // Sort by timestamp to verify chronological order
    const sortedLogs = logs.sort((a, b) =>
      new Date(a.eventTimestamp) - new Date(b.eventTimestamp)
    );

    // ========================================
    // Verify Log #1: CREATE by Seeded admin
    // ========================================
    const createLog = sortedLogs[0];
    expect(createLog.eventType).toBe('CREATE');
    expect(createLog.changedFields?.changes).toBeDefined(); // CREATE now stores created data
    expect(createLog.changedFields?.changes?.name).toBe('Dr. Audit Test');
    expect(createLog.changedFields?.changes?.role).toBe('clinician');
    // Email is stored in nested auth structure, not as direct field
    expect(createLog.changedFields?.changes?.auth).toBeDefined();

    // ========================================
    // Verify Log #2: UPDATE by Seeded admin (role → admin)
    // ========================================
    const update1Log = sortedLogs[1];
    expect(update1Log.eventType).toBe('UPDATE');
    expect(update1Log.actorUserId).toBeDefined(); // Seeded admin performed this action
    expect(update1Log.changedFields.changes.role).toBe('admin');

    // ========================================
    // Verify Log #3: UPDATE by Admin (role → clinician)
    // ========================================
    const update2Log = sortedLogs[2];
    expect(update2Log.eventType).toBe('UPDATE');
    expect(update2Log.actorUser.name).toBe('Audit Test Admin');
    expect(update2Log.changedFields.changes.role).toBe('clinician');

    // ========================================
    // Verify Log #4: UPDATE by Seeded admin (role → admin)
    // ========================================
    const update3Log = sortedLogs[3];
    expect(update3Log.eventType).toBe('UPDATE');
    expect(update3Log.actorUserId).toBeDefined(); // Seeded admin performed this action
    expect(update3Log.changedFields.changes.role).toBe('admin');

    // ========================================
    // Verify actor attribution
    // ========================================
    const adminLogs = logs.filter(log => log.actorUser.name === 'Audit Test Admin');
    expect(adminLogs.length).toBe(1); // Admin made 1 change (update2)

    // All logs should have a valid actorUserId
    logs.forEach(log => {
      expect(log.actorUserId).toBeDefined();
      expect(log.actorUser).toBeDefined();
    });

    // ========================================
    // Verify all logs point to the same entity
    // ========================================
    logs.forEach(log => {
      expect(log.entityType).toBe('User');
      expect(log.entityId).toBe(testUserId);
    });

  });

  it('should track role change correctly', async () => {
    // Create a user
    const createResponse = await waspOp('create-user', {
      name: 'Role Test User',
      email: generateTestEmail('roletest'),
      role: 'clinician'
    }, adminSessionId);

    expect(createResponse.status).toBe(200);
    const userId = createResponse.body.json.id;
    await new Promise(resolve => setTimeout(resolve, 300));

    // Update role
    const updateResponse = await waspOp('update-user-role', {
      userId: userId,
      role: 'admin'
    }, adminSessionId);

    expect(updateResponse.status).toBe(200);
    await new Promise(resolve => setTimeout(resolve, 300));

    // Verify audit log captured the change
    const auditLogsResponse = await waspOp('get-audit-logs-by-entity', {
      entityType: 'User',
      entityId: userId
    }, adminSessionId);

    expect(auditLogsResponse.status).toBe(200);
    const logs = auditLogsResponse.body.json;

    // Find the UPDATE log
    const updateLog = logs.find(log => log.eventType === 'UPDATE');
    expect(updateLog).toBeDefined();

    // Should have role in changedFields
    expect(updateLog.changedFields.changes.role).toBe('admin');
  });

  it('should maintain audit logs even when entity is updated frequently', async () => {
    // Create a user
    const createResponse = await waspOp('create-user', {
      name: 'Frequent Updates Test',
      email: generateTestEmail('frequent'),
      role: 'clinician'
    }, adminSessionId);

    expect(createResponse.status).toBe(200);
    const userId = createResponse.body.json.id;
    await new Promise(resolve => setTimeout(resolve, 300));

    // Make 5 rapid role changes
    const roles = ['admin', 'clinician', 'admin', 'clinician', 'admin'];
    for (let i = 0; i < roles.length; i++) {
      const updateResponse = await waspOp('update-user-role', {
        userId: userId,
        role: roles[i]
      }, adminSessionId);

      expect(updateResponse.status).toBe(200);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Wait for all audit logs to be written
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify all updates were logged
    const auditLogsResponse = await waspOp('get-audit-logs-by-entity', {
      entityType: 'User',
      entityId: userId
    }, adminSessionId);

    expect(auditLogsResponse.status).toBe(200);
    const logs = auditLogsResponse.body.json;

    // Should have 6 logs: 1 CREATE + 5 UPDATEs
    expect(logs.length).toBe(6);

    // Verify all updates are present
    const updateLogs = logs.filter(log => log.eventType === 'UPDATE');
    expect(updateLogs.length).toBe(5);
  });
});
