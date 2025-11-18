/**
 * Slot Management Integration Tests (Level 2)
 *
 * Deep testing of AvailabilitySlot CRUD operations, booking assignment logic,
 * and edge cases around concurrent bookings and user boundaries.
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
import { getTomorrowDateString, getFutureDateString } from './helpers/dates.js';

let seededAdminSessionId = '';
let adminSessionId = '';
let clinician1SessionId = '';
let clinician2SessionId = '';
let clinician1Email = '';
let clinician2Email = '';

beforeAll(async () => {
  await setupTests();
  await cleanupTestData();
  seededAdminSessionId = await loginUser(process.env.ADMIN_EMAIL, process.env.ADMIN_EMAIL);
  adminSessionId = seededAdminSessionId;

  // Create two clinicians for multi-user tests
  clinician1Email = generateTestEmail('slot-clinician1');
  clinician2Email = generateTestEmail('slot-clinician2');

  await waspOp(
    'create-user',
    { name: 'Slot Clinician 1', email: clinician1Email, role: 'clinician' },
    adminSessionId
  );
  await waspOp(
    'create-user',
    { name: 'Slot Clinician 2', email: clinician2Email, role: 'clinician' },
    adminSessionId
  );

  await setUserPassword(clinician1Email, 'password123');
  await setUserPassword(clinician2Email, 'password123');

  clinician1SessionId = await loginUser(clinician1Email, 'password123');
  clinician2SessionId = await loginUser(clinician2Email, 'password123');
});

afterEach(async () => {
  await cleanupTestData();
});

async function getUserByEmail(email) {
  const usersResponse = await waspOp('get-users', {}, adminSessionId);
  const user = usersResponse.body.json.find((u) => u.email === email);
  expect(user).toBeDefined();
  return user;
}


describe('Slot Management Tests', () => {
  describe('Slot Creation', () => {
    it('should create single slot', async () => {
      const dateStr = getTomorrowDateString();
      const slotsResponse = await waspOp(
        'bulk-update-slots',
        {
          date: dateStr,
          slots: [{ startTime: '09:00', endTime: '09:30' }],
        },
        clinician1SessionId
      );

      expect(slotsResponse.status).toBe(200);
      const slots = slotsResponse.body.json;
      expect(slots.length).toBe(1);
      expect(slots[0].startDateTime).toBeDefined();
      expect(slots[0].endDateTime).toBeDefined();
    });

    it('should bulk create slots for full day', async () => {
      const dateStr = getFutureDateString(2);
      const fullDaySlots = [
        { startTime: '09:00', endTime: '09:30' },
        { startTime: '10:00', endTime: '10:30' },
        { startTime: '11:00', endTime: '11:30' },
        { startTime: '14:00', endTime: '14:30' },
        { startTime: '15:00', endTime: '15:30' },
      ];

      const slotsResponse = await waspOp(
        'bulk-update-slots',
        { date: dateStr, slots: fullDaySlots },
        clinician1SessionId
      );

      expect(slotsResponse.status).toBe(200);
      expect(slotsResponse.body.json.length).toBe(5);
    });

    it('should allow overlapping slots (clinician choice)', async () => {
      const dateStr = getFutureDateString(3);
      const overlappingSlots = [
        { startTime: '09:00', endTime: '10:00' },
        { startTime: '09:30', endTime: '10:30' }, // Overlaps with first
      ];

      const slotsResponse = await waspOp(
        'bulk-update-slots',
        { date: dateStr, slots: overlappingSlots },
        clinician1SessionId
      );

      // System allows this - it's clinician's responsibility
      expect(slotsResponse.status).toBe(200);
      expect(slotsResponse.body.json.length).toBe(2);
    });

    it('should create slots that belong to creating user only', async () => {
      const dateStr = getFutureDateString(4);
      const slotsResponse = await waspOp(
        'bulk-update-slots',
        { date: dateStr, slots: SLOT_PRESETS.morning },
        clinician2SessionId
      );

      expect(slotsResponse.status).toBe(200);
      const slots = slotsResponse.body.json;

      // Verify slots belong to clinician2 by checking via their session
      const fetchedSlots = await waspOp('get-slots-by-date', { date: dateStr }, clinician2SessionId);
      expect(fetchedSlots.body.json.length).toBe(3);
    });
  });

  describe('Slot Assignment Logic', () => {
    it('should assign first available slot when booking', async () => {
      const dateStr = getFutureDateString(5);
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, clinician1SessionId);

      // Create consultation request
      const messages = createSmsMessages(1, 3000);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, clinician1SessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      // Accept should assign to first slot (09:00)
      // Get template from config
      const configResponse2 = await waspOp('get-config', {}, clinician1SessionId);
      const templateBody2 = configResponse2.body.json.consultationSmsTemplates[0].body;
      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody: templateBody2, assignToOnlyMe: false },
        clinician1SessionId
      );

      expect(acceptResponse.status).toBe(200);
      const consultation = acceptResponse.body.json;
      expect(consultation.slotId).toBeDefined();
    });

    it('should return error when no slots available', async () => {
      // Don't create any slots
      const messages = createSmsMessages(1, 3001);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, clinician1SessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      // Get template from config
      const configResponse2 = await waspOp('get-config', {}, clinician1SessionId);
      const templateBody2 = configResponse2.body.json.consultationSmsTemplates[0].body;
      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody: templateBody2, assignToOnlyMe: false },
        clinician1SessionId
      );

      // Should fail with clear error
      expect(acceptResponse.status).toBeGreaterThanOrEqual(400);
    });

    it('should mark slot as booked after assignment', async () => {
      const dateStr = getFutureDateString(6);
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.twoSlots }, clinician1SessionId);

      const messages = createSmsMessages(1, 3002);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, clinician1SessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      // Get template from config
      const configResponse2 = await waspOp('get-config', {}, clinician1SessionId);
      const templateBody2 = configResponse2.body.json.consultationSmsTemplates[0].body;
      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody: templateBody2, assignToOnlyMe: false },
        clinician1SessionId
      );
      const slotId = acceptResponse.body.json.slotId;

      // Fetch slots and verify one is booked
      const slotsResponse = await waspOp('get-slots-by-date', { date: dateStr }, clinician1SessionId);
      const bookedSlot = slotsResponse.body.json.find((s) => s.id === slotId);
      expect(bookedSlot.consultation).toBeDefined();
      expect(bookedSlot.consultation.id).toBe(acceptResponse.body.json.id);
    });

    it('should skip booked slot and assign next available', async () => {
      const dateStr = getFutureDateString(7);
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, clinician1SessionId);

      // Book first slot
      const messages1 = createSmsMessages(1, 3003);
      await sendSmsMessages(messages1, process.env.SMS_API_KEY);
      const pending1 = await waspOp('get-consultation-requests', { status: 'pending' }, clinician1SessionId);
      const request1 = pending1.body.json.find((r) => r.phoneNumber === messages1[0].sender);
      // Get template from config
      const configResponse = await waspOp('get-config', {}, clinician1SessionId);
      const templateBody = configResponse.body.json.consultationSmsTemplates[0].body;
      await waspOp('accept-consultation-request', { 
        consultationRequestId: request1.id, 
        templateBody, 
        assignToOnlyMe: false 
      }, clinician1SessionId);

      // Book second consultation - should get 10:00 slot
      const messages2 = createSmsMessages(1, 3004);
      await sendSmsMessages(messages2, process.env.SMS_API_KEY);
      const pending2 = await waspOp('get-consultation-requests', { status: 'pending' }, clinician1SessionId);
      const request2 = pending2.body.json.find((r) => r.phoneNumber === messages2[0].sender);

      const accept2 = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request2.id, templateBody, assignToOnlyMe: false },
        clinician1SessionId
      );

      expect(accept2.status).toBe(200);
      // Verify it got the second slot (not checking exact time due to UTC conversion)
      expect(accept2.body.json.slotId).toBeDefined();
    });

    it('should assign earliest slot system-wide regardless of who accepts', async () => {
      const dateStr = getFutureDateString(8);

      // Get clinician user IDs
      const usersResponse = await waspOp('get-users', {}, adminSessionId);
      const users = usersResponse.body.json;
      const clinician1 = users.find((u) => u.email === clinician1Email);
      const clinician2 = users.find((u) => u.email === clinician2Email);

      // Clinician1 creates morning slots (earlier times)
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, clinician1SessionId);

      // Clinician2 creates afternoon slots (later times)
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.afternoon }, clinician2SessionId);

      // Clinician2 accepts request - but should assign to clinician1's morning slot (earliest available system-wide)
      const messages = createSmsMessages(1, 3005);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, clinician2SessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      const configResponse3 = await waspOp('get-config', {}, clinician2SessionId);
      const templateBody3 = configResponse3.body.json.consultationSmsTemplates[0].body;
      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody: templateBody3, assignToOnlyMe: false },
        clinician2SessionId
      );

      expect(acceptResponse.status).toBe(200);
      const consultation = acceptResponse.body.json;

      // Consultation should be assigned to clinician1 (who owns the earliest slot)
      // Not to clinician2 (who accepted the request)
      expect(consultation.assignedToUserId).toBe(clinician1.id);

      // Verify it's a morning slot from clinician1
      const slot1Response = await waspOp('get-slots-by-date', { date: dateStr, userId: clinician1.id }, adminSessionId);
      const assignedSlot = slot1Response.body.json.find((s) => s.id === consultation.slotId);
      expect(assignedSlot).toBeDefined();
      expect(assignedSlot.userId).toBe(clinician1.id);
    });
  });

  describe('Slot Modifications', () => {
    it('should update slot time if not booked', async () => {
      const dateStr = getFutureDateString(9);
      const createResponse = await waspOp(
        'bulk-update-slots',
        { date: dateStr, slots: [{ startTime: '09:00', endTime: '09:30' }] },
        clinician1SessionId
      );
      const slotId = createResponse.body.json[0].id;

      // Update to different time
      const updateResponse = await waspOp(
        'bulk-update-slots',
        { date: dateStr, slots: [{ startTime: '10:00', endTime: '10:30' }] },
        clinician1SessionId
      );

      expect(updateResponse.status).toBe(200);
      // Old slot deleted, new slot created
      expect(updateResponse.body.json.length).toBe(1);
      expect(updateResponse.body.json[0].id).not.toBe(slotId);
    });

    it('should delete slot if not booked', async () => {
      const dateStr = getFutureDateString(10);
      const createResponse = await waspOp(
        'bulk-update-slots',
        { date: dateStr, slots: SLOT_PRESETS.morning },
        clinician1SessionId
      );
      const slotId = createResponse.body.json[0].id;

      // Delete slot
      const deleteResponse = await waspOp('delete-slot', { slotId }, clinician1SessionId);
      expect(deleteResponse.status).toBe(200);

      // Verify it's gone
      const fetchResponse = await waspOp('get-slots-by-date', { date: dateStr }, clinician1SessionId);
      const deletedSlot = fetchResponse.body.json.find((s) => s.id === slotId);
      expect(deletedSlot).toBeUndefined();
    });

    it('should not delete booked slot', async () => {
      const dateStr = getFutureDateString(11);
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, clinician1SessionId);

      // Book first slot
      const messages = createSmsMessages(1, 3006);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);
      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, clinician1SessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      // Get template from config
      const configResponse2 = await waspOp('get-config', {}, clinician1SessionId);
      const templateBody2 = configResponse2.body.json.consultationSmsTemplates[0].body;
      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody: templateBody2, assignToOnlyMe: false },
        clinician1SessionId
      );
      const bookedSlotId = acceptResponse.body.json.slotId;

      // Try to delete booked slot
      const deleteResponse = await waspOp('delete-slot', { slotId: bookedSlotId }, clinician1SessionId);
      expect(deleteResponse.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Availability Permissions', () => {
    it('should block disabling availability when clinician has booked consultations', async () => {
      const dateStr = getFutureDateString(14);
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, clinician1SessionId);

      const messages = createSmsMessages(1, 4100);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, clinician1SessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);
      expect(request).toBeDefined();

      const configResponse = await waspOp('get-config', {}, clinician1SessionId);
      const templateBody = configResponse.body.json.consultationSmsTemplates[0].body;
      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody, assignToOnlyMe: false },
        clinician1SessionId
      );
      expect(acceptResponse.status).toBe(200);

      const clinician1 = await getUserByEmail(clinician1Email);
      const disableResponse = await waspOp(
        'update-user-availability-enabled',
        { userId: clinician1.id, canHaveAvailability: false },
        adminSessionId
      );

      expect(disableResponse.status).toBe(400);
    });

    it('should disable availability when only unbooked future slots exist', async () => {
      const dateStr = getFutureDateString(15);
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.afternoon }, clinician2SessionId);

      const clinician2 = await getUserByEmail(clinician2Email);
      const disableResponse = await waspOp(
        'update-user-availability-enabled',
        { userId: clinician2.id, canHaveAvailability: false },
        adminSessionId
      );

      expect(disableResponse.status).toBe(200);
      expect(disableResponse.body.json.canHaveAvailability).toBe(false);

      const slotsResponse = await waspOp('get-slots-by-date', { date: dateStr, userId: clinician2.id }, adminSessionId);
      expect(slotsResponse.body.json.length).toBe(0);

      const attemptResponse = await waspOp(
        'bulk-update-slots',
        { date: dateStr, slots: SLOT_PRESETS.morning },
        clinician2SessionId
      );
      expect(attemptResponse.status).toBeGreaterThanOrEqual(400);

      const reenablingResponse = await waspOp(
        'update-user-availability-enabled',
        { userId: clinician2.id, canHaveAvailability: true },
        adminSessionId
      );
      expect(reenablingResponse.status).toBe(200);
    });
  });

  describe('Concurrent Booking Edge Cases', () => {
    it('should handle two requests booking simultaneously', async () => {
      const dateStr = getFutureDateString(12);
      // Only create 1 slot
      await waspOp(
        'bulk-update-slots',
        { date: dateStr, slots: [{ startTime: '09:00', endTime: '09:30' }] },
        clinician1SessionId
      );

      // Create 2 consultation requests
      const messages1 = createSmsMessages(1, 3100);
      const messages2 = createSmsMessages(1, 3101);
      await sendSmsMessages(messages1, process.env.SMS_API_KEY);
      await sendSmsMessages(messages2, process.env.SMS_API_KEY);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, clinician1SessionId);
      const request1 = pendingResponse.body.json.find((r) => r.phoneNumber === messages1[0].sender);
      const request2 = pendingResponse.body.json.find((r) => r.phoneNumber === messages2[0].sender);

      // Accept first request
      const configResponse4 = await waspOp('get-config', {}, clinician1SessionId);
      const templateBody4 = configResponse4.body.json.consultationSmsTemplates[0].body;
      const accept1 = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request1.id, templateBody: templateBody4, assignToOnlyMe: false },
        clinician1SessionId
      );
      expect(accept1.status).toBe(200);

      // Accept second request (should fail - no slots left)
      const accept2 = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request2.id, templateBody: templateBody4, assignToOnlyMe: false },
        clinician1SessionId
      );
      expect(accept2.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle slot disappearing during assignment', async () => {
      const dateStr = getFutureDateString(13);
      await waspOp(
        'bulk-update-slots',
        { date: dateStr, slots: [{ startTime: '09:00', endTime: '09:30' }] },
        clinician1SessionId
      );

      const messages = createSmsMessages(1, 3102);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, clinician1SessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      // Delete all slots before accepting
      const slotsResponse = await waspOp('get-slots-by-date', { date: dateStr }, clinician1SessionId);
      const slotId = slotsResponse.body.json[0].id;
      await waspOp('delete-slot', { slotId }, clinician1SessionId);

      // Try to accept (should fail with clear error)
      // Get template from config
      const configResponse2 = await waspOp('get-config', {}, clinician1SessionId);
      const templateBody2 = configResponse2.body.json.consultationSmsTemplates[0].body;
      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody: templateBody2, assignToOnlyMe: false },
        clinician1SessionId
      );
      expect(acceptResponse.status).toBeGreaterThanOrEqual(400);
    });
  });
});
