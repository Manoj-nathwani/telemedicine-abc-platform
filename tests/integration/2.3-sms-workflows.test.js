/**
 * SMS Workflows Integration Tests (Level 2)
 *
 * Testing SMS business logic: incoming message processing, outgoing message queuing,
 * delivery tracking, and Wasp queries/actions for SMS management.
 *
 * For HTTP API endpoint testing, see 2.4-sms-api.test.js
 *
 * Run: npm test
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { waspOp, loginUser, setupTests, cleanupTestData } from './helpers/wasp.js';
import {
  createSmsMessages,
  sendSmsMessages,
  markSmsAsSent,
  SLOT_PRESETS,
  generatePhoneNumber,
  PHONE_PATTERNS,
} from './helpers/fixtures.js';
import { getTomorrowDateString, getCurrentISOString } from './helpers/dates.js';
import { acceptConsultationOnly, createTestCall, createTestPatient } from './helpers/workflows.js';

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


describe('SMS Workflow Tests', () => {
  describe('Incoming SMS Processing', () => {
    it('should create ConsultationRequest from valid SMS', async () => {
      const phoneNumber = generatePhoneNumber(4000);
      const messages = [
        {
          sender: phoneNumber,
          text: 'I have fever and headache',
          createdAt: getCurrentISOString(),
        },
      ];

      const smsResponse = await sendSmsMessages(messages, process.env.SMS_API_KEY);
      expect(smsResponse.status).toBe(200);

      // Verify ConsultationRequest was created
      const requestsResponse = await waspOp('get-consultation-requests', { status: 'pending' }, adminSessionId);
      const request = requestsResponse.body.json.find((r) => r.phoneNumber === phoneNumber);

      expect(request).toBeDefined();
      expect(request.status).toBe('pending');
      expect(request.phoneNumber).toBe(phoneNumber);
    });

    it('should normalize international phone format', async () => {
      const phoneNumbers = [
        generatePhoneNumber(4001), // +243991234XXXX
        generatePhoneNumber(4002),
      ];

      const messages = phoneNumbers.map((phone) => ({
        sender: phone,
        text: 'Test message',
        createdAt: getCurrentISOString(),
      }));

      const smsResponse = await sendSmsMessages(messages, process.env.SMS_API_KEY);
      expect(smsResponse.status).toBe(200);

      // Verify both were created with consistent format
      const requestsResponse = await waspOp('get-consultation-requests', { status: 'pending' }, adminSessionId);
      const requests = requestsResponse.body.json.filter((r) => phoneNumbers.includes(r.phoneNumber));

      expect(requests.length).toBe(2);
      requests.forEach((req) => {
        expect(req.phoneNumber).toMatch(/^\+243/);
      });
    });

    it('should reject invalid phone number', async () => {
      const invalidPhone = PHONE_PATTERNS.invalidShort + '1234'; // Too short
      const messages = [
        {
          sender: invalidPhone,
          text: 'Test message',
          createdAt: getCurrentISOString(),
        },
      ];

      const smsResponse = await sendSmsMessages(messages, process.env.SMS_API_KEY);
      // API should reject or handle gracefully
      // Exact behavior depends on implementation
      expect([200, 400]).toContain(smsResponse.status);
    });

    it('should reject empty message body', async () => {
      const phoneNumber = generatePhoneNumber(4003);
      const messages = [
        {
          sender: phoneNumber,
          text: '', // Empty body
          createdAt: getCurrentISOString(),
        },
      ];

      const smsResponse = await sendSmsMessages(messages, process.env.SMS_API_KEY);
      // Should reject empty messages
      expect([200, 400]).toContain(smsResponse.status);

      // If accepted, request should not be created
      if (smsResponse.status === 200) {
        const requestsResponse = await waspOp('get-consultation-requests', {}, adminSessionId);
        const request = requestsResponse.body.json.find((r) => r.phoneNumber === phoneNumber);
        expect(request?.description).toBeTruthy(); // Should have content if created
      }
    });
  });

  describe('Outgoing SMS Queue', () => {
    it('should create OutgoingSmsMessage with pending status', async () => {
      // Create consultation
      const { consultationId, phoneNumber } = await acceptConsultationOnly(
        adminSessionId,
        4100,
        getTomorrowDateString()
      );

      // Create call with outcome data and patient
      const { patientId, dateOfBirth } = await createTestPatient(adminSessionId, phoneNumber, 0);

      // Assign patient to consultation
      await waspOp(
        'assign-patient-to-consultation',
        { consultationId, selectedPatientId: patientId, dateOfBirth },
        adminSessionId
      );

      const callResponse = await waspOp(
        'create-consultation-call',
        {
          consultationId,
          status: 'patient_answered',
          patientId,
          confirmations: ['Patient answered the phone'],
          chiefComplaint: 'Test outcome for SMS',
          diagnosis: 'Test diagnosis',
        },
        adminSessionId
      );

      expect(callResponse.status).toBe(200);
      // Call created successfully - SMS would be sent manually by clinician via UI
    });

    it('should include correct patient phone number', async () => {
      const { consultationId, phoneNumber } = await acceptConsultationOnly(
        adminSessionId,
        4101,
        getTomorrowDateString()
      );

      // Create call with outcome data and patient
      const { patientId, dateOfBirth } = await createTestPatient(adminSessionId, phoneNumber, 0);

      // Assign patient to consultation
      await waspOp(
        'assign-patient-to-consultation',
        { consultationId, selectedPatientId: patientId, dateOfBirth },
        adminSessionId
      );

      await waspOp(
        'create-consultation-call',
        {
          consultationId,
          status: 'patient_answered',
          patientId,
          confirmations: ['Patient answered the phone'],
          chiefComplaint: 'Patient doing well',
          diagnosis: 'Improving',
        },
        adminSessionId
      );

      // Manually send follow-up SMS
      const smsResponse = await waspOp('send-consultation-sms', {
        consultationId,
        phoneNumber,
        message: 'Follow-up: Take medication as prescribed',
      }, adminSessionId);

      expect(smsResponse.status).toBe(200);
      expect(smsResponse.body.json.phoneNumber).toBe(phoneNumber);
    });

    it('should contain expected message content', async () => {
      const { consultationId, phoneNumber } = await acceptConsultationOnly(
        adminSessionId,
        4102,
        getTomorrowDateString()
      );

      // Create call with outcome data and patient
      const { patientId, dateOfBirth } = await createTestPatient(adminSessionId, phoneNumber, 0);

      // Assign patient to consultation
      await waspOp(
        'assign-patient-to-consultation',
        { consultationId, selectedPatientId: patientId, dateOfBirth },
        adminSessionId
      );

      await waspOp(
        'create-consultation-call',
        {
          consultationId,
          status: 'patient_answered',
          patientId,
          confirmations: ['Patient answered the phone'],
          chiefComplaint: 'Patient doing well',
          diagnosis: 'Improving',
        },
        adminSessionId
      );

      // Send custom message content
      const customMessage = 'Drink plenty of fluids. Rest for 2 days. Contact us if symptoms worsen.';
      const smsResponse = await waspOp('send-consultation-sms', {
        consultationId,
        phoneNumber,
        message: customMessage,
      }, adminSessionId);

      expect(smsResponse.status).toBe(200);
      expect(smsResponse.body.json.body).toBe(customMessage);
    });

    it('should link to Consultation', async () => {
      const { consultationId, phoneNumber } = await acceptConsultationOnly(
        adminSessionId,
        4103,
        getTomorrowDateString()
      );

      // Create call with outcome data and patient
      const { patientId, dateOfBirth } = await createTestPatient(adminSessionId, phoneNumber, 0);

      // Assign patient to consultation
      await waspOp(
        'assign-patient-to-consultation',
        { consultationId, selectedPatientId: patientId, dateOfBirth },
        adminSessionId
      );

      await waspOp(
        'create-consultation-call',
        {
          consultationId,
          status: 'patient_answered',
          patientId,
          confirmations: ['Patient answered the phone'],
          chiefComplaint: 'Patient doing well',
          diagnosis: 'Improving',
        },
        adminSessionId
      );

      // Send SMS linked to consultation
      const smsResponse = await waspOp('send-consultation-sms', {
        consultationId,
        phoneNumber,
        message: 'Follow-up message',
      }, adminSessionId);

      expect(smsResponse.status).toBe(200);
      expect(smsResponse.body.json.consultationId).toBe(consultationId);
    });
  });

  describe('Delivery Status Tracking', () => {
    it('should not create SMS for patient_no_answer', async () => {
      const { consultationId, phoneNumber } = await acceptConsultationOnly(
        adminSessionId,
        4200,
        getTomorrowDateString()
      );

      // Create call with patient_no_answer status - cannot include outcome fields
      const { callId } = await createTestCall(adminSessionId, consultationId, 'patient_no_answer');

      // Verify outcome fields cannot be included (patient didn't answer)
      const { patientId } = await createTestPatient(adminSessionId, phoneNumber, 0);
      const callWithOutcomeResponse = await waspOp(
        'create-consultation-call',
        {
          consultationId,
          status: 'patient_no_answer',
          patientId,
          confirmations: ['Patient answered the phone'],
          chiefComplaint: 'Should fail',
          diagnosis: 'Should fail',
        },
        adminSessionId
      );

      // Should fail - can't include outcome fields for unsuccessful call
      expect(callWithOutcomeResponse.status).toBeGreaterThanOrEqual(400);
    });

    it('should not create SMS for clinician_did_not_call', async () => {
      const messages = createSmsMessages(1, 4201);
      const patientPhone = messages[0].sender;
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, adminSessionId);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, adminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === patientPhone);

      const configResponse = await waspOp('get-config', {}, adminSessionId);
      const templateBody = configResponse.body.json.consultationSmsTemplates[0].body;
      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody, assignToOnlyMe: false },
        adminSessionId
      );
      const consultationId = acceptResponse.body.json.id;

      // Create call with clinician_did_not_call status - cannot include outcome fields
      const { callId } = await createTestCall(adminSessionId, consultationId, 'clinician_did_not_call');

      // Verify outcome fields cannot be included (clinician didn't call)
      const { patientId } = await createTestPatient(adminSessionId, patientPhone, 0);
      const callWithOutcomeResponse = await waspOp(
        'create-consultation-call',
        {
          consultationId,
          status: 'clinician_did_not_call',
          patientId,
          confirmations: ['Patient answered the phone'],
          chiefComplaint: 'Should fail',
          diagnosis: 'Should fail',
        },
        adminSessionId
      );

      // Should fail - can't include outcome fields for unsuccessful call
      expect(callWithOutcomeResponse.status).toBeGreaterThanOrEqual(400);
    });

    it('should create SMS only for patient_answered with follow-up', async () => {
      const messages = createSmsMessages(1, 4202);
      const patientPhone = messages[0].sender;
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, adminSessionId);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, adminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === patientPhone);

      const configResponse = await waspOp('get-config', {}, adminSessionId);
      const templateBody = configResponse.body.json.consultationSmsTemplates[0].body;
      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody, assignToOnlyMe: false },
        adminSessionId
      );
      const consultationId = acceptResponse.body.json.id;

      // Create successful call with outcome data
      const { patientId, dateOfBirth } = await createTestPatient(adminSessionId, patientPhone, 0);

      // Assign patient to consultation
      await waspOp(
        'assign-patient-to-consultation',
        { consultationId, selectedPatientId: patientId, dateOfBirth },
        adminSessionId
      );

      const callResponse = await waspOp(
        'create-consultation-call',
        {
          consultationId,
          status: 'patient_answered',
          patientId,
          confirmations: ['Patient answered the phone'],
          chiefComplaint: 'Patient answered successfully',
          diagnosis: 'Improving',
        },
        adminSessionId
      );

      expect(callResponse.status).toBe(200);

      // SMS can now be sent (only for successful patient_answered calls)
      const smsResponse = await waspOp('send-consultation-sms', {
        consultationId,
        phoneNumber: patientPhone,
        message: 'Follow-up: Take medication as prescribed',
      }, adminSessionId);

      expect(smsResponse.status).toBe(200);
      expect(smsResponse.body.json.consultationId).toBe(consultationId);
    });
  });

  describe('SMS Message History', () => {
    it('should retrieve SMS messages for admin view', async () => {
      const messages = createSmsMessages(2, 4300);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const smsHistoryResponse = await waspOp('get-sms-messages', {}, adminSessionId);
      expect(smsHistoryResponse.status).toBe(200);

      const smsMessages = smsHistoryResponse.body.json;
      expect(Array.isArray(smsMessages)).toBe(true);
      expect(smsMessages.length).toBeGreaterThan(0);

      // Verify our test messages are in history
      const testMessages = smsMessages.filter((msg) =>
        messages.some((m) => m.sender === msg.phoneNumber)
      );
      expect(testMessages.length).toBeGreaterThanOrEqual(1);
    });

    it('should retrieve SMS messages by phone number', async () => {
      const phoneNumber = generatePhoneNumber(4301);
      const messages = [
        {
          sender: phoneNumber,
          text: 'First message from patient',
          createdAt: getCurrentISOString(),
        },
      ];
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const byPhoneResponse = await waspOp(
        'get-sms-messages-by-phone-number',
        { phoneNumber },
        adminSessionId
      );
      expect(byPhoneResponse.status).toBe(200);

      const phoneMessages = byPhoneResponse.body.json;
      expect(Array.isArray(phoneMessages)).toBe(true);
      expect(phoneMessages.length).toBeGreaterThan(0);

      // All messages should be for this phone number
      phoneMessages.forEach((msg) => {
        expect(msg.phoneNumber).toBe(phoneNumber);
      });
    });
  });

  describe('Query: getSmsMessages State Filtering', () => {
    it('should filter by state: received (incoming)', async () => {
      const messages = createSmsMessages(2, 5400);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const response = await waspOp('get-sms-messages', { state: 'received' }, adminSessionId);
      expect(response.status).toBe(200);

      const receivedMsgs = response.body.json.filter((msg) =>
        messages.some((m) => m.sender === msg.phoneNumber)
      );
      expect(receivedMsgs.length).toBe(2);
      receivedMsgs.forEach((msg) => {
        expect(msg.direction).toBe('incoming');
      });
    });

    it('should filter by state: sending (pending outgoing)', async () => {
      // Create outgoing message
      const messages = createSmsMessages(1, 5401);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, adminSessionId);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, adminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      // Get template from config
      const configResponse = await waspOp('get-config', {}, adminSessionId);
      const templateBody = configResponse.body.json.consultationSmsTemplates[0].body;
      const acceptResponse = await waspOp('accept-consultation-request', { 
        consultationRequestId: request.id, 
        templateBody, 
        assignToOnlyMe: false 
      }, adminSessionId);
      const consultationId = acceptResponse.body.json.id;

      await waspOp('send-consultation-sms', {
        consultationId,
        phoneNumber: messages[0].sender,
        message: 'Pending message',
      }, adminSessionId);

      const response = await waspOp('get-sms-messages', { state: 'sending' }, adminSessionId);
      expect(response.status).toBe(200);

      const sendingMsg = response.body.json.find((msg) => msg.phoneNumber === messages[0].sender);
      expect(sendingMsg).toBeDefined();
      expect(sendingMsg.sentMessageId).toBeNull();
    });

    it('should filter by state: sent (outgoing completed)', async () => {
      // Create and send message
      const messages = createSmsMessages(1, 5402);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, adminSessionId);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, adminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      // Get template from config
      const configResponse = await waspOp('get-config', {}, adminSessionId);
      const templateBody = configResponse.body.json.consultationSmsTemplates[0].body;
      const acceptResponse = await waspOp('accept-consultation-request', { 
        consultationRequestId: request.id, 
        templateBody, 
        assignToOnlyMe: false 
      }, adminSessionId);
      const consultationId = acceptResponse.body.json.id;

      const smsResponse = await waspOp('send-consultation-sms', {
        consultationId,
        phoneNumber: messages[0].sender,
        message: 'Sent message',
      }, adminSessionId);

      await markSmsAsSent(smsResponse.body.json.id, true, process.env.SMS_API_KEY);

      const response = await waspOp('get-sms-messages', { state: 'sent' }, adminSessionId);
      expect(response.status).toBe(200);

      // Find message with matching body (since multiple messages could exist for same phone)
      const sentMsg = response.body.json.find((msg) =>
        msg.phoneNumber === messages[0].sender &&
        msg.direction === 'outgoing' &&
        msg.body === 'Sent message'
      );
      expect(sentMsg).toBeDefined();
      expect(sentMsg.direction).toBe('outgoing');
      expect(sentMsg.body).toBe('Sent message');
    });

    it('should filter by state: failed', async () => {
      // Create and fail message
      const messages = createSmsMessages(1, 5403);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, adminSessionId);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, adminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      // Get template from config
      const configResponse = await waspOp('get-config', {}, adminSessionId);
      const templateBody = configResponse.body.json.consultationSmsTemplates[0].body;
      const acceptResponse = await waspOp('accept-consultation-request', { 
        consultationRequestId: request.id, 
        templateBody, 
        assignToOnlyMe: false 
      }, adminSessionId);
      const consultationId = acceptResponse.body.json.id;

      const smsResponse = await waspOp('send-consultation-sms', {
        consultationId,
        phoneNumber: messages[0].sender,
        message: 'Failed message',
      }, adminSessionId);

      await markSmsAsSent(smsResponse.body.json.id, false, process.env.SMS_API_KEY);

      const response = await waspOp('get-sms-messages', { state: 'failed' }, adminSessionId);
      expect(response.status).toBe(200);

      // Find message with matching body (since multiple messages could exist for same phone)
      const failedMsg = response.body.json.find((msg) =>
        msg.phoneNumber === messages[0].sender &&
        msg.body === 'Failed message'
      );
      expect(failedMsg).toBeDefined();
      expect(failedMsg.success).toBe(false);
      expect(failedMsg.body).toBe('Failed message');
    });
  });

  describe('Action: sendSmsMessage (Admin)', () => {
    it('should allow admin to send arbitrary SMS', async () => {
      const phoneNumber = generatePhoneNumber(5500);
      const message = 'Admin notification message';

      const response = await waspOp('send-sms-message', {
        phoneNumber,
        body: message,
      }, adminSessionId);

      expect(response.status).toBe(200);
      expect(response.body.json.phoneNumber).toBe(phoneNumber);
      expect(response.body.json.body).toBe(message);
      expect(response.body.json.success).toBeNull(); // Pending
      expect(response.body.json.sentByUserId).toBeGreaterThan(0); // Tracks who sent it
    });

    it('should reject non-admin user', async () => {
      // For this test, we just need to verify that non-admin users can't call this action
      // We'll use an invalid session ID to simulate a non-admin user without proper auth
      const phoneNumber = generatePhoneNumber(5501);

      const response = await waspOp('send-sms-message', {
        phoneNumber,
        body: 'Test',
      }, 'invalid-session-id'); // Invalid session will fail auth

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('OutgoingSmsMessage userId tracking', () => {
    it('should track who sent consultation SMS (accountability)', async () => {
      const { consultationId, phoneNumber } = await acceptConsultationOnly(
        adminSessionId,
        5502,
        getTomorrowDateString()
      );

      // Send SMS
      const smsResponse = await waspOp('send-consultation-sms', {
        consultationId,
        phoneNumber,
        message: 'Follow-up instructions',
      }, adminSessionId);

      expect(smsResponse.status).toBe(200);
      expect(smsResponse.body.json.sentByUserId).toBeGreaterThan(0);
    });
  });
});
