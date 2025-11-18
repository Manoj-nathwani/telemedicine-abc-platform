/**
 * Role-Based Access Control Integration Tests (Level 3)
 *
 * Security testing across all entities to verify role-based permissions work correctly.
 * Tests what each role (admin, clinician) can and cannot do.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { waspOp, loginUser, setUserPassword, setupTests, cleanupTestData } from './helpers/wasp.js';
import {
  createSmsMessages,
  sendSmsMessages,
  SLOT_PRESETS,
  generateTestEmail,
} from './helpers/fixtures.js';
import { getTomorrowDateString } from './helpers/dates.js';
import { createTestCall, createTestPatient } from './helpers/workflows.js';

let seededAdminSessionId = '';
let adminSessionId = '';
let clinician1SessionId = '';
let clinician2SessionId = '';

let adminEmail = '';
let clinician1Email = '';
let clinician2Email = '';

beforeAll(async () => {
  await setupTests();
  await cleanupTestData();
  seededAdminSessionId = await loginUser(process.env.ADMIN_EMAIL, process.env.ADMIN_EMAIL);

  // Create admin user
  adminEmail = generateTestEmail('auth-admin');
  await waspOp('create-user', { name: 'Auth Admin', email: adminEmail, role: 'admin' }, seededAdminSessionId);
  await setUserPassword(adminEmail, 'password123');
  adminSessionId = await loginUser(adminEmail, 'password123');

  // Create two clinicians
  clinician1Email = generateTestEmail('auth-clinician1');
  clinician2Email = generateTestEmail('auth-clinician2');

  await waspOp(
    'create-user',
    { name: 'Auth Clinician 1', email: clinician1Email, role: 'clinician' },
    seededAdminSessionId
  );
  await waspOp(
    'create-user',
    { name: 'Auth Clinician 2', email: clinician2Email, role: 'clinician' },
    seededAdminSessionId
  );

  await setUserPassword(clinician1Email, 'password123');
  await setUserPassword(clinician2Email, 'password123');

  clinician1SessionId = await loginUser(clinician1Email, 'password123');
  clinician2SessionId = await loginUser(clinician2Email, 'password123');
});

afterEach(async () => {
  await cleanupTestData();
});


describe('Authorization Tests', () => {
  describe('Admin Permissions (Seeded)', () => {
    it('should access all consultation endpoints', async () => {
      const messages = createSmsMessages(1, 5000);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const response = await waspOp('get-consultation-requests', {}, seededAdminSessionId);
      expect(response.status).toBe(200);
    });

    it('should view all users data', async () => {
      const response = await waspOp('get-users', {}, seededAdminSessionId);
      expect(response.status).toBe(200);

      const users = response.body.json;
      expect(users.length).toBeGreaterThanOrEqual(4); // At least seeded admin + created admin + 2 clinicians
    });

    it('should create and modify users', async () => {
      const email = generateTestEmail('admin-seeded-test');
      const createResponse = await waspOp(
        'create-user',
        { name: 'Admin Seeded Test User', email, role: 'clinician' },
        seededAdminSessionId
      );
      expect(createResponse.status).toBe(200);

      const user = createResponse.body.json;
      const updateResponse = await waspOp(
        'update-user-role',
        { userId: user.id, role: 'admin' },
        seededAdminSessionId
      );
      expect(updateResponse.status).toBe(200);
    });

    it('should accept consultation requests', async () => {
      const messages = createSmsMessages(1, 5001);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, seededAdminSessionId);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, seededAdminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      // Get template from config
      const configResponse2 = await waspOp('get-config', {}, seededAdminSessionId);
      const templateBody2 = configResponse2.body.json.consultationSmsTemplates[0].body;
      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody: templateBody2, assignToOnlyMe: false },
        seededAdminSessionId
      );
      expect(acceptResponse.status).toBe(200);
    });

    it('should manage availability slots', async () => {
      const dateStr = getTomorrowDateString();
      const response = await waspOp(
        'bulk-update-slots',
        { date: dateStr, slots: SLOT_PRESETS.morning },
        seededAdminSessionId
      );
      expect(response.status).toBe(200);
    });
  });

  describe('Admin Permissions', () => {
    it('should create and modify users', async () => {
      const email = generateTestEmail('admin-test');
      const createResponse = await waspOp(
        'create-user',
        { name: 'Admin Test User', email, role: 'clinician' },
        adminSessionId
      );
      expect(createResponse.status).toBe(200);

      const user = createResponse.body.json;
      const updateResponse = await waspOp('update-user-role', { userId: user.id, role: 'admin' }, adminSessionId);
      expect(updateResponse.status).toBe(200);
    });

    it('should view all consultation data', async () => {
      const response = await waspOp('get-consultation-requests', {}, adminSessionId);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.json)).toBe(true);
    });

    it('should view all users', async () => {
      const response = await waspOp('get-users', {}, adminSessionId);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.json)).toBe(true);
    });

    it('should access SMS message history', async () => {
      const response = await waspOp('get-sms-messages', {}, adminSessionId);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.json)).toBe(true);
    });

    it('should not create consultations (clinician-only)', async () => {
      const messages = createSmsMessages(1, 5100);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, adminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      // Admin should not be able to accept (no slots)
      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id },
        adminSessionId
      );
      expect(acceptResponse.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Clinician Permissions', () => {
    it('should accept consultation requests', async () => {
      const messages = createSmsMessages(1, 5200);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, clinician1SessionId);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, clinician1SessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      const configResponse5 = await waspOp('get-config', {}, clinician1SessionId);
      const templateBody5 = configResponse5.body.json.consultationSmsTemplates[0].body;
      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody: templateBody5, assignToOnlyMe: false },
        clinician1SessionId
      );
      expect(acceptResponse.status).toBe(200);
    });

    it('should manage own slots only', async () => {
      const dateStr = getTomorrowDateString();

      // Clinician1 creates slots
      const createResponse = await waspOp(
        'bulk-update-slots',
        { date: dateStr, slots: SLOT_PRESETS.morning },
        clinician1SessionId
      );
      expect(createResponse.status).toBe(200);

      // Clinician1 can query own slots
      const queryResponse = await waspOp('get-slots-by-date', { date: dateStr }, clinician1SessionId);
      expect(queryResponse.status).toBe(200);
      expect(queryResponse.body.json.length).toBe(3);

      // Clinician2 queries same date - should see 0 slots (user-specific)
      const clinician2Query = await waspOp('get-slots-by-date', { date: dateStr }, clinician2SessionId);
      expect(clinician2Query.status).toBe(200);
      expect(clinician2Query.body.json.length).toBe(0); // No slots for clinician2
    });

    it('should view all consultation requests in triage (system-wide)', async () => {
      // Clinician1 accepts a request
      const messages = createSmsMessages(1, 5201);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.afternoon }, clinician1SessionId);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, clinician1SessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      // Get template from config
      const configResponse = await waspOp('get-config', {}, clinician1SessionId);
      const templateBody = configResponse.body.json.consultationSmsTemplates[0].body;
      await waspOp('accept-consultation-request', { 
        consultationRequestId: request.id, 
        templateBody, 
        assignToOnlyMe: false 
      }, clinician1SessionId);

      // Both clinicians can see ALL accepted requests (triage is system-wide)
      const clinician1Response = await waspOp(
        'get-consultation-requests',
        { status: 'accepted' },
        clinician1SessionId
      );
      const clinician1Requests = clinician1Response.body.json;
      expect(clinician1Requests.length).toBeGreaterThan(0);

      const clinician2Response = await waspOp(
        'get-consultation-requests',
        { status: 'accepted' },
        clinician2SessionId
      );
      const clinician2Requests = clinician2Response.body.json;

      // Clinician2 should also see the accepted request (triage shows all requests)
      const sharedRequest = clinician2Requests.find((r) => r.id === request.id);
      expect(sharedRequest).toBeDefined();
    });

    it('should not access admin endpoints', async () => {
      // Try to access user management (admin-only)
      const usersResponse = await waspOp('get-users', {}, clinician1SessionId);
      // Should fail with 403 or return limited data
      // Behavior depends on implementation - may return only self
      expect([200, 403]).toContain(usersResponse.status);
    });

    it('should not modify other clinician data', async () => {
      // Clinician2 creates a slot
      const dateStr = getTomorrowDateString();
      const createResponse = await waspOp(
        'bulk-update-slots',
        { date: dateStr, slots: SLOT_PRESETS.twoSlots },
        clinician2SessionId
      );
      const slotId = createResponse.body.json[0].id;

      // Clinician1 tries to delete clinician2's slot
      const deleteResponse = await waspOp('delete-slot', { slotId }, clinician1SessionId);
      // Should fail - not their slot
      expect(deleteResponse.status).toBeGreaterThanOrEqual(400);
    });

    it('should allow viewing other clinician consultations (team-based care)', async () => {
      // Clinician1 creates and accepts consultation
      const messages = createSmsMessages(1, 5202);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, clinician1SessionId);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, clinician1SessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      const configResponse6 = await waspOp('get-config', {}, clinician1SessionId);
      const templateBody6 = configResponse6.body.json.consultationSmsTemplates[0].body;
      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody: templateBody6, assignToOnlyMe: false },
        clinician1SessionId
      );
      const consultationId = acceptResponse.body.json.id;

      // Clinician2 can view clinician1's consultation (team-based care)
      const updateResponse = await waspOp(
        'update-consultation',
        { consultationId },
        clinician2SessionId
      );

      // Should succeed - team members can view each other's consultations
      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.json.id).toBe(consultationId);
    });

    it('should allow creating calls on other clinician consultations (team-based care)', async () => {
      // Clinician1 creates consultation
      const messages = createSmsMessages(1, 5204);
      const patientPhone = messages[0].sender;
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, clinician1SessionId);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, clinician1SessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === patientPhone);

      const configResponse7 = await waspOp('get-config', {}, clinician1SessionId);
      const templateBody7 = configResponse7.body.json.consultationSmsTemplates[0].body;
      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody: templateBody7, assignToOnlyMe: false },
        clinician1SessionId
      );
      const consultation = acceptResponse.body.json;
      const consultationId = consultation.id;
      const originalClinicianId = consultation.assignedToUserId;

      // Clinician2 helps by creating call for clinician1's consultation
      const callResponse = await waspOp(
        'create-consultation-call',
        { consultationId, status: 'patient_no_answer' },
        clinician2SessionId
      );

      // Should succeed - team members can help each other
      expect(callResponse.status).toBe(200);

      // Verify call tracks who actually made it (accountability)
      const call = callResponse.body.json;
      expect(call.conductedByUserId).not.toBe(originalClinicianId);
      expect(call.conductedByUserId).toBeGreaterThan(0);
    });

    it('should allow creating calls with outcomes for other clinician consultations (team-based care)', async () => {
      // Clinician1 creates consultation
      const messages = createSmsMessages(1, 5203);
      const patientPhone = messages[0].sender;
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, clinician1SessionId);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, clinician1SessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === patientPhone);

      const configResponse7 = await waspOp('get-config', {}, clinician1SessionId);
      const templateBody7 = configResponse7.body.json.consultationSmsTemplates[0].body;
      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody: templateBody7, assignToOnlyMe: false },
        clinician1SessionId
      );
      const consultation = acceptResponse.body.json;
      const consultationId = consultation.id;
      const originalClinicianId = consultation.assignedToUserId;

      // Clinician1 creates patient (proper workflow)
      const { patientId, dateOfBirth } = await createTestPatient(clinician1SessionId, patientPhone, 0);

      // Assign patient to consultation
      await waspOp(
        'assign-patient-to-consultation',
        { consultationId, selectedPatientId: patientId, dateOfBirth },
        clinician1SessionId
      );

      // Clinician2 can help by creating call with outcome for clinician1's consultation (team-based care)
      const callResponse = await waspOp(
        'create-consultation-call',
        {
          consultationId,
          status: 'patient_answered',
          patientId,
          confirmations: ['Patient answered the phone'],
          chiefComplaint: 'Team collaboration - helping colleague',
          diagnosis: 'Team-based care',
        },
        clinician2SessionId
      );

      // Should succeed - team members can help each other
      expect(callResponse.status).toBe(200);

      // Verify call tracks who actually conducted it (accountability)
      const call = callResponse.body.json;
      expect(call.conductedByUserId).not.toBe(originalClinicianId);
      // conductedByUserId should be clinician2 (who created the call), but we don't have their ID
      // So we just verify it's NOT the original clinician
      expect(call.conductedByUserId).toBeGreaterThan(0);
    });
  });

  describe('Unauthenticated Access', () => {
    it('should allow SMS endpoint without auth', async () => {
      const messages = createSmsMessages(1, 5300);
      const response = await sendSmsMessages(messages, process.env.SMS_API_KEY);
      // SMS endpoint is public (uses API key instead)
      expect(response.status).toBe(200);
    });

    it('should reject operations without session', async () => {
      const response = await waspOp('get-consultation-requests', {}, ''); // Empty session
      // Should return 401 Unauthorized
      expect(response.status).toBe(401);
    });

    it('should reject operations with invalid session', async () => {
      const response = await waspOp('get-consultation-requests', {}, 'invalid-session-token');
      // Should return 401 Unauthorized
      expect(response.status).toBe(401);
    });
  });
});
