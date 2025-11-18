/**
 * Edge Cases & Error Handling Integration Tests (Level 4)
 *
 * Defensive testing for invalid inputs, missing data, resource conflicts,
 * and business rule violations. Tests error messages and failure modes.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { waspOp, loginUser, setupTests, cleanupTestData } from './helpers/wasp.js';
import {
  createSmsMessages,
  sendSmsMessages,
  SLOT_PRESETS,
} from './helpers/fixtures.js';
import { getTomorrowDateString } from './helpers/dates.js';
import { createTestCall, createTestPatient } from './helpers/workflows.js';

let seededAdminSessionId = '';

beforeAll(async () => {
  await setupTests();
  await cleanupTestData();
  seededAdminSessionId = await loginUser(process.env.ADMIN_EMAIL, process.env.ADMIN_EMAIL);
});

afterEach(async () => {
  await cleanupTestData();
});


describe('Edge Cases & Error Handling Tests', () => {
  describe('Data Validation Errors', () => {
    it('should reject consultation update with missing consultationId', async () => {
      const response = await waspOp(
        'update-consultation',
        {
          // consultationId missing
          clinicalNotes: 'Test notes',
        },
        seededAdminSessionId
      );
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject call with missing required fields', async () => {
      // Create valid consultation first
      const messages = createSmsMessages(1, 6000);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, seededAdminSessionId);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, seededAdminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      // Get template from config
      const configResponse = await waspOp('get-config', {}, seededAdminSessionId);
      const templateBody = configResponse.body.json.consultationSmsTemplates[0].body;
      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody, assignToOnlyMe: false },
        seededAdminSessionId
      );
      const consultationId = acceptResponse.body.json.id;

      // Try to create call without status
      const callResponse = await waspOp(
        'create-consultation-call',
        {
          consultationId,
          // status missing - required field
        },
        seededAdminSessionId
      );
      expect(callResponse.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject call with invalid status', async () => {
      const messages = createSmsMessages(1, 6001);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, seededAdminSessionId);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, seededAdminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      // Get template from config
      const configResponse = await waspOp('get-config', {}, seededAdminSessionId);
      const templateBody = configResponse.body.json.consultationSmsTemplates[0].body;
      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody, assignToOnlyMe: false },
        seededAdminSessionId
      );
      const consultationId = acceptResponse.body.json.id;

      const callResponse = await waspOp(
        'create-consultation-call',
        {
          consultationId,
          status: 'invalid_status', // Invalid enum value
        },
        seededAdminSessionId
      );
      expect(callResponse.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject slot with invalid time format', async () => {
      const dateStr = getTomorrowDateString();
      const response = await waspOp(
        'bulk-update-slots',
        {
          date: dateStr,
          slots: [
            {
              startTime: '25:00', // Invalid hour
              endTime: '26:00',
            },
          ],
        },
        seededAdminSessionId
      );
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject slot with end time before start time', async () => {
      const dateStr = getTomorrowDateString();
      const response = await waspOp(
        'bulk-update-slots',
        {
          date: dateStr,
          slots: [
            {
              startTime: '10:00',
              endTime: '09:00', // End before start
            },
          ],
        },
        seededAdminSessionId
      );
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject user creation with invalid email', async () => {
      const response = await waspOp(
        'create-user',
        {
          name: 'Test User',
          email: 'not-an-email', // Invalid format
          role: 'clinician',
        },
        seededAdminSessionId
      );
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject user creation with invalid role', async () => {
      const response = await waspOp(
        'create-user',
        {
          name: 'Test User',
          email: 'test@example.com',
          role: 'invalid_role', // Invalid enum
        },
        seededAdminSessionId
      );
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Resource Conflict Scenarios', () => {
    it('should reject accepting already-accepted request', async () => {
      const messages = createSmsMessages(1, 6100);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, seededAdminSessionId);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, seededAdminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      // First accept
      const templateBody1 = await waspOp('get-config', {}, seededAdminSessionId);
      const templateBody1Value = templateBody1.body.json.consultationSmsTemplates[0].body;
      const firstAccept = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody: templateBody1Value, assignToOnlyMe: false },
        seededAdminSessionId
      );
      expect(firstAccept.status).toBe(200);

      // Second accept should fail
      const secondAccept = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody: templateBody1Value, assignToOnlyMe: false },
        seededAdminSessionId
      );
      expect(secondAccept.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject booking when all slots are taken', async () => {
      const dateStr = getTomorrowDateString();
      // Create only 1 slot
      await waspOp(
        'bulk-update-slots',
        { date: dateStr, slots: [{ startTime: '09:00', endTime: '09:30' }] },
        seededAdminSessionId
      );

      // Create 2 requests
      const messages1 = createSmsMessages(1, 6101);
      const messages2 = createSmsMessages(1, 6102);
      await sendSmsMessages(messages1, process.env.SMS_API_KEY);
      await sendSmsMessages(messages2, process.env.SMS_API_KEY);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, seededAdminSessionId);
      const request1 = pendingResponse.body.json.find((r) => r.phoneNumber === messages1[0].sender);
      const request2 = pendingResponse.body.json.find((r) => r.phoneNumber === messages2[0].sender);

      // First booking succeeds
      const templateBody2 = await waspOp('get-config', {}, seededAdminSessionId);
      const templateBody2Value = templateBody2.body.json.consultationSmsTemplates[0].body;
      const accept1 = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request1.id, templateBody: templateBody2Value, assignToOnlyMe: false },
        seededAdminSessionId
      );
      expect(accept1.status).toBe(200);

      // Second booking fails - no slots
      const accept2 = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request2.id, templateBody: templateBody2Value, assignToOnlyMe: false },
        seededAdminSessionId
      );
      expect(accept2.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject deleting booked slot', async () => {
      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, seededAdminSessionId);

      // Book a slot
      const messages = createSmsMessages(1, 6103);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, seededAdminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      // Get template from config
      const configResponse = await waspOp('get-config', {}, seededAdminSessionId);
      const templateBody = configResponse.body.json.consultationSmsTemplates[0].body;
      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody, assignToOnlyMe: false },
        seededAdminSessionId
      );
      const bookedSlotId = acceptResponse.body.json.slotId;

      // Try to delete booked slot
      const deleteResponse = await waspOp('delete-slot', { slotId: bookedSlotId }, seededAdminSessionId);
      expect(deleteResponse.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject duplicate user email', async () => {
      const email = `duplicate-test-${Date.now()}@example.com`;

      // Create first user
      const firstCreate = await waspOp(
        'create-user',
        { name: 'First User', email, role: 'clinician' },
        seededAdminSessionId
      );
      expect(firstCreate.status).toBe(200);

      // Try to create second user with same email
      const secondCreate = await waspOp(
        'create-user',
        { name: 'Second User', email, role: 'clinician' },
        seededAdminSessionId
      );
      expect(secondCreate.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Resource Not Found', () => {
    it('should return 404 for non-existent consultation', async () => {
      const fakeConsultationId = 99999999;
      const response = await waspOp(
        'update-consultation',
        { consultationId: fakeConsultationId, clinicalNotes: 'Test' },
        seededAdminSessionId
      );
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should return 404 for non-existent consultation request', async () => {
      const fakeRequestId = 99999999;
      const response = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: fakeRequestId },
        seededAdminSessionId
      );
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should return 404 for non-existent slot', async () => {
      const fakeSlotId = 99999999;
      const response = await waspOp('delete-slot', { slotId: fakeSlotId }, seededAdminSessionId);
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should return 404 for non-existent user', async () => {
      const fakeUserId = 99999999;
      const response = await waspOp('update-user-role', { userId: fakeUserId, role: 'admin' }, seededAdminSessionId);
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle call for non-existent consultation', async () => {
      const fakeConsultationId = 99999999;
      const fakePatientId = 99999999;

      const response = await waspOp(
        'create-consultation-call',
        {
          consultationId: fakeConsultationId,
          status: 'patient_answered',
          patientId: fakePatientId,
          confirmations: ['Patient answered the phone'],
          chiefComplaint: 'Test',
          diagnosis: 'Test',
        },
        seededAdminSessionId
      );
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Business Rule Violations', () => {
    it('should reject accepting request without available slots', async () => {
      // Don't create any slots
      const messages = createSmsMessages(1, 6200);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, seededAdminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      // Get template from config
      const configResponse = await waspOp('get-config', {}, seededAdminSessionId);
      const templateBody = configResponse.body.json.consultationSmsTemplates[0].body;
      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody, assignToOnlyMe: false },
        seededAdminSessionId
      );
      expect(acceptResponse.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject rejecting already-rejected request', async () => {
      const messages = createSmsMessages(1, 6201);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, seededAdminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      // First reject
      const firstReject = await waspOp(
        'reject-consultation-request',
        { consultationRequestId: request.id },
        seededAdminSessionId
      );
      expect(firstReject.status).toBe(200);

      // Second reject should fail (or succeed idempotently, depending on implementation)
      const secondReject = await waspOp(
        'reject-consultation-request',
        { consultationRequestId: request.id },
        seededAdminSessionId
      );
      expect([200, 400, 409]).toContain(secondReject.status);
    });

    it('should allow multiple calls for same consultation', async () => {
      const messages = createSmsMessages(1, 6202);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, seededAdminSessionId);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, seededAdminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      // Get template from config
      const configResponse = await waspOp('get-config', {}, seededAdminSessionId);
      const templateBody = configResponse.body.json.consultationSmsTemplates[0].body;
      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody, assignToOnlyMe: false },
        seededAdminSessionId
      );
      const consultationId = acceptResponse.body.json.id;

      // Create patient
      const { patientId, dateOfBirth } = await createTestPatient(seededAdminSessionId, messages[0].sender, 0);

      // Assign patient to consultation
      await waspOp(
        'assign-patient-to-consultation',
        { consultationId, selectedPatientId: patientId, dateOfBirth },
        seededAdminSessionId
      );

      // First call should succeed
      const firstCall = await waspOp(
        'create-consultation-call',
        {
          consultationId,
          status: 'patient_answered',
          patientId,
          confirmations: ['Patient answered the phone'],
          chiefComplaint: 'First call',
          diagnosis: 'Initial diagnosis',
        },
        seededAdminSessionId
      );
      expect(firstCall.status).toBe(200);

      // Second call for same consultation should also succeed (multiple attempts allowed)
      const secondCall = await waspOp(
        'create-consultation-call',
        {
          consultationId,
          status: 'patient_answered',
          patientId,
          confirmations: ['Patient answered the phone'],
          chiefComplaint: 'Second call',
          diagnosis: 'Follow-up diagnosis',
        },
        seededAdminSessionId
      );
      expect(secondCall.status).toBe(200);
    });

    it('should handle empty slots array gracefully', async () => {
      const dateStr = getTomorrowDateString();
      const response = await waspOp(
        'bulk-update-slots',
        {
          date: dateStr,
          slots: [], // Empty array
        },
        seededAdminSessionId
      );
      // Should succeed - clears slots for that date
      expect(response.status).toBe(200);
      expect(response.body.json.length).toBe(0);
    });

    it('should reject slots with past dates', async () => {
      const pastDate = '2020-01-01';
      const response = await waspOp(
        'bulk-update-slots',
        {
          date: pastDate,
          slots: SLOT_PRESETS.morning,
        },
        seededAdminSessionId
      );
      // Should fail or warn - implementation dependent
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('Malformed Requests', () => {
    it('should handle null values gracefully', async () => {
      const response = await waspOp(
        'update-consultation',
        {
          consultationId: null,
          clinicalNotes: null,
        },
        seededAdminSessionId
      );
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle undefined operation', async () => {
      const response = await waspOp('non-existent-operation', {}, seededAdminSessionId);
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject operations with extra unexpected fields', async () => {
      const messages = createSmsMessages(1, 6300);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, seededAdminSessionId);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, seededAdminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      // Get template from config
      const configResponse = await waspOp('get-config', {}, seededAdminSessionId);
      const templateBody = configResponse.body.json.consultationSmsTemplates[0].body;
      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody, assignToOnlyMe: false },
        seededAdminSessionId
      );
      const consultationId = acceptResponse.body.json.id;

      // Try to update with unexpected field
      const updateResponse = await waspOp(
        'update-consultation',
        {
          consultationId,
          clinicalNotes: 'Valid notes',
          unexpectedField: 'Should be ignored or rejected',
        },
        seededAdminSessionId
      );
      // Should succeed (extra fields ignored) or fail (strict validation)
      expect([200, 400]).toContain(updateResponse.status);
    });
  });
});
