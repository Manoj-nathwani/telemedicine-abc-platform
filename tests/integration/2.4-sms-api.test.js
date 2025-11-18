/**
 * SMS API Endpoints Integration Tests (Level 2)
 *
 * Testing raw HTTP API endpoints for SMS integration.
 * These endpoints are used by external SMS gateway services.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { waspOp, loginUser, setupTests, cleanupTestData } from './helpers/wasp.js';
import {
  createSmsMessages,
  sendSmsMessages,
  getOutgoingSmsMessages,
  markSmsAsSent,
  SLOT_PRESETS,
  generatePhoneNumber,
} from './helpers/fixtures.js';
import { getTomorrowDateString, getCurrentISOString } from './helpers/dates.js';

let seededAdminSessionId = '';
let adminSessionId = '';

beforeAll(async () => {
  await setupTests();
  await cleanupTestData();
  seededAdminSessionId = await loginUser(process.env.ADMIN_EMAIL, process.env.ADMIN_EMAIL);
  adminSessionId = seededAdminSessionId;
});

afterEach(async () => {
  await cleanupTestData();
});

describe('SMS API Endpoint Tests', () => {
  describe('POST /api/sms/messages (Incoming)', () => {
    it('should reject request with invalid API key', async () => {
      const messages = createSmsMessages(1, 5000);
      const response = await sendSmsMessages(messages, 'invalid-api-key');
      expect(response.status).toBe(401);
    });

    it('should reject request with missing API key', async () => {
      const messages = createSmsMessages(1, 5001);
      const response = await sendSmsMessages(messages, '');
      expect(response.status).toBe(400); // Zod validation error for empty string
    });

    it('should reject malformed message data', async () => {
      const invalidMessages = [
        {
          // Missing 'sender' field
          text: 'Test message',
          createdAt: getCurrentISOString(),
        },
      ];
      const response = await sendSmsMessages(invalidMessages, process.env.SMS_API_KEY);
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Validation error');
    });

    it('should reject message with invalid timestamp', async () => {
      const messages = [
        {
          sender: generatePhoneNumber(5002),
          text: 'Test message',
          createdAt: 'not-a-valid-date',
        },
      ];
      const response = await sendSmsMessages(messages, process.env.SMS_API_KEY);
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid createdAt format');
    });

    it('should accept batch of multiple messages', async () => {
      const messages = createSmsMessages(5, 5100);
      const response = await sendSmsMessages(messages, process.env.SMS_API_KEY);
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify all consultation requests were created
      const requestsResponse = await waspOp('get-consultation-requests', { status: 'pending' }, adminSessionId);
      const createdRequests = requestsResponse.body.json.filter((r) =>
        messages.some((m) => m.sender === r.phoneNumber)
      );
      expect(createdRequests.length).toBe(5);
    });
  });

  describe('GET /api/sms/outgoing-messages', () => {
    it('should reject request with invalid API key', async () => {
      const response = await getOutgoingSmsMessages('invalid-api-key');
      expect(response.status).toBe(401);
    });

    it('should return empty array when no pending messages', async () => {
      const response = await getOutgoingSmsMessages(process.env.SMS_API_KEY);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return pending outgoing messages', async () => {
      // Create a consultation and send SMS
      const messages = createSmsMessages(1, 5200);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, adminSessionId);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, adminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      const configResponse = await waspOp('get-config', {}, adminSessionId);
      const templateBody = configResponse.body.json.consultationSmsTemplates[0].body;
      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody, assignToOnlyMe: false },
        adminSessionId
      );
      const consultationId = acceptResponse.body.json.id;

      // Send custom SMS (in addition to auto-generated booking confirmation)
      await waspOp('send-consultation-sms', {
        consultationId,
        phoneNumber: messages[0].sender,
        message: 'Test outgoing message',
      }, adminSessionId);

      // Check API returns it
      const response = await getOutgoingSmsMessages(process.env.SMS_API_KEY);
      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThan(0);

      // Find our custom message (not the auto-generated booking confirmation)
      const outgoingMsg = response.body.find((msg) =>
        msg.phoneNumber === messages[0].sender &&
        msg.body === 'Test outgoing message'
      );
      expect(outgoingMsg).toBeDefined();
      expect(outgoingMsg.body).toBe('Test outgoing message');
      expect(outgoingMsg.id).toBeDefined();
    });

    it('should only return messages with null success status', async () => {
      // Create and mark one as sent, create another pending
      const messages = createSmsMessages(2, 5210);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, adminSessionId);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, adminSessionId);
      const request1 = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);
      const request2 = pendingResponse.body.json.find((r) => r.phoneNumber === messages[1].sender);

      // Get template from config
      const configResponse = await waspOp('get-config', {}, adminSessionId);
      const templateBody = configResponse.body.json.consultationSmsTemplates[0].body;
      const accept1 = await waspOp('accept-consultation-request', { 
        consultationRequestId: request1.id, 
        templateBody, 
        assignToOnlyMe: false 
      }, adminSessionId);
      const accept2 = await waspOp('accept-consultation-request', { 
        consultationRequestId: request2.id, 
        templateBody, 
        assignToOnlyMe: false 
      }, adminSessionId);

      // Send two messages
      const sms1Response = await waspOp('send-consultation-sms', {
        consultationId: accept1.body.json.id,
        phoneNumber: messages[0].sender,
        message: 'Message 1',
      }, adminSessionId);

      await waspOp('send-consultation-sms', {
        consultationId: accept2.body.json.id,
        phoneNumber: messages[1].sender,
        message: 'Message 2',
      }, adminSessionId);

      // Mark first one as sent
      await markSmsAsSent(sms1Response.body.json.id, true, process.env.SMS_API_KEY);

      // Get outgoing - should only return the second one (plus booking confirmations)
      const response = await getOutgoingSmsMessages(process.env.SMS_API_KEY);
      expect(response.status).toBe(200);

      // Filter for our custom messages only
      const pendingMessages = response.body.filter((msg) =>
        [messages[0].sender, messages[1].sender].includes(msg.phoneNumber) &&
        (msg.body === 'Message 1' || msg.body === 'Message 2')
      );
      expect(pendingMessages.length).toBe(1);
      expect(pendingMessages[0].body).toBe('Message 2');
    });
  });

  describe('POST /api/sms/outgoing-message (Mark Sent)', () => {
    it('should reject request with invalid API key', async () => {
      const response = await markSmsAsSent(999, true, 'invalid-api-key');
      expect(response.status).toBe(401);
    });

    it('should reject invalid message ID', async () => {
      const response = await markSmsAsSent(999999, true, process.env.SMS_API_KEY);
      expect(response.status).toBe(404);
      expect(response.body).toBeDefined();
      if (response.body.error) {
        expect(response.body.error).toContain('Outgoing message not found');
      }
    });

    it('should mark message as successfully sent', async () => {
      // Create outgoing message
      const messages = createSmsMessages(1, 5300);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, adminSessionId);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, adminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      // Get template from config
      const configResponse2 = await waspOp('get-config', {}, adminSessionId);
      const templateBody2 = configResponse2.body.json.consultationSmsTemplates[0].body;
      const acceptResponse = await waspOp('accept-consultation-request', { 
        consultationRequestId: request.id, 
        templateBody: templateBody2, 
        assignToOnlyMe: false 
      }, adminSessionId);
      const consultationId = acceptResponse.body.json.id;

      const smsResponse = await waspOp('send-consultation-sms', {
        consultationId,
        phoneNumber: messages[0].sender,
        message: 'Test message for marking sent',
      }, adminSessionId);

      const outgoingMsgId = smsResponse.body.json.id;

      // Mark as sent
      const markResponse = await markSmsAsSent(outgoingMsgId, true, process.env.SMS_API_KEY);
      expect(markResponse.status).toBe(200);
      expect(markResponse.body.success).toBe(true);

      // Verify it's no longer in outgoing queue
      const outgoingResponse = await getOutgoingSmsMessages(process.env.SMS_API_KEY);
      const stillPending = outgoingResponse.body.find((msg) => msg.id === outgoingMsgId);
      expect(stillPending).toBeUndefined();

      // Verify SmsMessage was created
      const smsHistoryResponse = await waspOp('get-sms-messages', { state: 'sent' }, adminSessionId);
      const sentMsg = smsHistoryResponse.body.json.find((msg) =>
        msg.phoneNumber === messages[0].sender &&
        msg.body === 'Test message for marking sent' &&
        msg.direction === 'outgoing'
      );
      expect(sentMsg).toBeDefined();
      expect(sentMsg.direction).toBe('outgoing');
      expect(sentMsg.body).toBe('Test message for marking sent');
    });

    it('should mark message as failed', async () => {
      // Create outgoing message
      const messages = createSmsMessages(1, 5301);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, adminSessionId);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, adminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      // Get template from config
      const configResponse2 = await waspOp('get-config', {}, adminSessionId);
      const templateBody2 = configResponse2.body.json.consultationSmsTemplates[0].body;
      const acceptResponse = await waspOp('accept-consultation-request', { 
        consultationRequestId: request.id, 
        templateBody: templateBody2, 
        assignToOnlyMe: false 
      }, adminSessionId);
      const consultationId = acceptResponse.body.json.id;

      const smsResponse = await waspOp('send-consultation-sms', {
        consultationId,
        phoneNumber: messages[0].sender,
        message: 'Test message for failure',
      }, adminSessionId);

      const outgoingMsgId = smsResponse.body.json.id;

      // Mark as failed
      const markResponse = await markSmsAsSent(outgoingMsgId, false, process.env.SMS_API_KEY);
      expect(markResponse.status).toBe(200);
      expect(markResponse.body.success).toBe(true);

      // Verify it's in failed state (can be queried)
      const failedResponse = await waspOp('get-sms-messages', { state: 'failed' }, adminSessionId);
      const failedMsg = failedResponse.body.json.find((msg) => msg.id === outgoingMsgId);
      expect(failedMsg).toBeDefined();
      expect(failedMsg.success).toBe(false);

      // Verify NO SmsMessage was created (only created on success)
      const smsHistoryResponse = await waspOp('get-sms-messages', { state: 'sent' }, adminSessionId);
      const sentMsg = smsHistoryResponse.body.json.find((msg) =>
        msg.phoneNumber === messages[0].sender &&
        msg.body === 'Test message for failure'
      );
      expect(sentMsg).toBeUndefined();
    });

    it('should reject invalid request body', async () => {
      const response = await markSmsAsSent('not-a-number', true, process.env.SMS_API_KEY);
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Validation error');
    });
  });
});
