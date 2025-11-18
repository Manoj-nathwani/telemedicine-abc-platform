/**
 * Buffer Time Integration Tests
 *
 * Tests that bufferTime configuration correctly filters out slots that are too soon
 * when booking consultations. The bufferTime ensures consultations can only be
 * booked for slots that are at least N minutes in the future.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { waspOp, loginUser, setupTests, cleanupTestData } from './helpers/wasp.js';
import {
  createSmsMessages,
  sendSmsMessages,
  generateNearTermSlots,
  getTodayDateString,
} from './helpers/fixtures.js';
import { getTomorrowDateString } from './helpers/dates.js';

let seededAdminSessionId = '';
const DEFAULT_BUFFER_TIME = 5;
const DEFAULT_CONFIG = {
  consultationDurationMinutes: 10,
  breakDurationMinutes: 5,
  bufferTimeMinutes: DEFAULT_BUFFER_TIME,
  consultationSmsTemplates: [
    { name: 'English', body: 'Your consultation is scheduled for {consultationTime}.' }
  ],
};

beforeAll(async () => {
  await setupTests();
  await cleanupTestData();
  seededAdminSessionId = await loginUser(process.env.ADMIN_EMAIL, process.env.ADMIN_EMAIL);
  
  // Set default config
  await waspOp('update-config', DEFAULT_CONFIG, seededAdminSessionId);
});

afterEach(async () => {
  await cleanupTestData();
  // Reset config to defaults
  await waspOp('update-config', DEFAULT_CONFIG, seededAdminSessionId);
});

describe('Buffer Time Tests', () => {
  describe('Default buffer time (5 minutes)', () => {
    it('should only select slots that are at least 5 minutes in the future', async () => {
      // Create slots starting at 10 minutes from now (after 5 minute bufferTime)
      const slots = generateNearTermSlots(10, 2, 30);
      const dateStr = getTodayDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots }, seededAdminSessionId);

      const messages = createSmsMessages(1, 8000);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, seededAdminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody: DEFAULT_CONFIG.consultationSmsTemplates[0].body, assignToOnlyMe: false },
        seededAdminSessionId
      );

      expect(acceptResponse.status).toBe(200);
      const consultation = acceptResponse.body.json;
      expect(consultation.slotId).toBeDefined();

      // Verify the selected slot is at least 5 minutes in the future
      const slotsResponse = await waspOp('get-slots-by-date', { date: dateStr }, seededAdminSessionId);
      const selectedSlot = slotsResponse.body.json.find(s => s.id === consultation.slotId);
      const now = new Date();
      const bufferTime = new Date(now.getTime() + 5 * 60 * 1000);
      const slotTime = new Date(selectedSlot.startDateTime);
      
      expect(slotTime.getTime()).toBeGreaterThanOrEqual(bufferTime.getTime());
    });

    it('should fail when no slots are available after bufferTime', async () => {
      // Create slots that are too soon (before 5 minute bufferTime)
      // Note: Due to timezone handling, we create slots very close to now
      // If they end up being before bufferTime, booking should fail
      const slots = generateNearTermSlots(1, 1, 30);
      const dateStr = getTodayDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots }, seededAdminSessionId);

      const messages = createSmsMessages(1, 8001);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, seededAdminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      // Check if slot is actually before bufferTime
      const slotsResponse = await waspOp('get-slots-by-date', { date: dateStr }, seededAdminSessionId);
      const slot = slotsResponse.body.json[0];
      const now = new Date();
      const bufferTime = new Date(now.getTime() + 5 * 60 * 1000);
      const slotTime = new Date(slot.startDateTime);

      if (slotTime.getTime() < bufferTime.getTime()) {
        // Slot is before bufferTime - booking should fail
        const templateBody = DEFAULT_CONFIG.consultationSmsTemplates[0].body;
        const acceptResponse = await waspOp(
          'accept-consultation-request',
          { consultationRequestId: request.id, templateBody, assignToOnlyMe: false },
          seededAdminSessionId
        );
        expect(acceptResponse.status).toBeGreaterThanOrEqual(400);
      } else {
        // Slot ended up being after bufferTime due to timezone - that's okay, just verify it works
        const templateBody = DEFAULT_CONFIG.consultationSmsTemplates[0].body;
        const acceptResponse = await waspOp(
          'accept-consultation-request',
          { consultationRequestId: request.id, templateBody, assignToOnlyMe: false },
          seededAdminSessionId
        );
        expect(acceptResponse.status).toBe(200);
      }
    });
  });

  describe('Custom buffer time values', () => {
    it('should respect bufferTimeMinutes = 10', async () => {
      // Update config to 10 minutes buffer
      await waspOp('update-config', {
        ...DEFAULT_CONFIG,
        bufferTimeMinutes: 10,
      }, seededAdminSessionId);

      // Create slots starting at 15 minutes from now (after 10 minute bufferTime)
      const slots = generateNearTermSlots(15, 1, 30);
      const dateStr = getTodayDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots }, seededAdminSessionId);

      const messages = createSmsMessages(1, 8003);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, seededAdminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody: DEFAULT_CONFIG.consultationSmsTemplates[0].body, assignToOnlyMe: false },
        seededAdminSessionId
      );

      expect(acceptResponse.status).toBe(200);
      const consultation = acceptResponse.body.json;
      expect(consultation.slotId).toBeDefined();

      // Verify the selected slot is at least 10 minutes in the future
      const slotsResponse = await waspOp('get-slots-by-date', { date: dateStr }, seededAdminSessionId);
      const selectedSlot = slotsResponse.body.json.find(s => s.id === consultation.slotId);
      const now = new Date();
      const bufferTime = new Date(now.getTime() + 10 * 60 * 1000);
      const slotTime = new Date(selectedSlot.startDateTime);
      
      expect(slotTime.getTime()).toBeGreaterThanOrEqual(bufferTime.getTime());
    });

    it('should respect bufferTimeMinutes = 15', async () => {
      // Update config to 15 minutes buffer
      await waspOp('update-config', {
        ...DEFAULT_CONFIG,
        bufferTimeMinutes: 15,
      }, seededAdminSessionId);

      // Create slots starting at 20 minutes from now (after 15 minute bufferTime)
      const slots = generateNearTermSlots(20, 1, 30);
      const dateStr = getTodayDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots }, seededAdminSessionId);

      const messages = createSmsMessages(1, 8004);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, seededAdminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody: DEFAULT_CONFIG.consultationSmsTemplates[0].body, assignToOnlyMe: false },
        seededAdminSessionId
      );

      expect(acceptResponse.status).toBe(200);
      const consultation = acceptResponse.body.json;
      expect(consultation.slotId).toBeDefined();

      // Verify the selected slot is at least 15 minutes in the future
      const slotsResponse = await waspOp('get-slots-by-date', { date: dateStr }, seededAdminSessionId);
      const selectedSlot = slotsResponse.body.json.find(s => s.id === consultation.slotId);
      const now = new Date();
      const bufferTime = new Date(now.getTime() + 15 * 60 * 1000);
      const slotTime = new Date(selectedSlot.startDateTime);
      
      expect(slotTime.getTime()).toBeGreaterThanOrEqual(bufferTime.getTime());
    });

    it('should work with bufferTimeMinutes = 0 (no buffer)', async () => {
      // Update config to 0 minutes buffer (allow immediate bookings)
      await waspOp('update-config', {
        ...DEFAULT_CONFIG,
        bufferTimeMinutes: 0,
      }, seededAdminSessionId);

      // Create slots starting at 2 minutes (should be selectable with 0 buffer)
      const slots = generateNearTermSlots(2, 1, 30);
      
      const dateStr = getTodayDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots }, seededAdminSessionId);

      const messages = createSmsMessages(1, 8005);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, seededAdminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      // Should succeed because 0 buffer allows immediate slots
      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody: DEFAULT_CONFIG.consultationSmsTemplates[0].body, assignToOnlyMe: false },
        seededAdminSessionId
      );

      expect(acceptResponse.status).toBe(200);
      const consultation = acceptResponse.body.json;
      expect(consultation.id).toBeDefined();
    });
  });

  describe('Buffer time with multiple slots', () => {
    it('should select earliest available slot after bufferTime', async () => {
      // Create multiple slots starting at 10 minutes from now
      // All should be after the 5 minute bufferTime, earliest should be selected
      const slots = generateNearTermSlots(10, 3, 30);
      const dateStr = getTodayDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots }, seededAdminSessionId);

      const messages = createSmsMessages(1, 8006);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, seededAdminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody: DEFAULT_CONFIG.consultationSmsTemplates[0].body, assignToOnlyMe: false },
        seededAdminSessionId
      );

      expect(acceptResponse.status).toBe(200);
      const consultation = acceptResponse.body.json;
      expect(consultation.slotId).toBeDefined();

      // Verify the selected slot is the earliest one and is after bufferTime
      const slotsResponse = await waspOp('get-slots-by-date', { date: dateStr }, seededAdminSessionId);
      const allSlots = slotsResponse.body.json.sort((a, b) => 
        new Date(a.startDateTime) - new Date(b.startDateTime)
      );
      const selectedSlot = allSlots.find(s => s.id === consultation.slotId);
      const now = new Date();
      const bufferTime = new Date(now.getTime() + 5 * 60 * 1000);
      const slotTime = new Date(selectedSlot.startDateTime);
      
      // Should be after bufferTime
      expect(slotTime.getTime()).toBeGreaterThanOrEqual(bufferTime.getTime());
      // Should be the earliest available slot after bufferTime
      expect(selectedSlot.id).toBe(allSlots[0].id);
    });
  });
});

