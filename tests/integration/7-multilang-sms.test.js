/**
 * Multi-template SMS Integration Tests
 *
 * Testing template selection during consultation request acceptance and
 * verification that SMS messages are sent with the correct template.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { waspOp, loginUser, setupTests, cleanupTestData } from './helpers/wasp.js';
import {
  createSmsMessages,
  sendSmsMessages,
  SLOT_PRESETS,
  generatePhoneNumber,
} from './helpers/fixtures.js';
import { getTomorrowDateString } from './helpers/dates.js';

let seededAdminSessionId = '';

const DEFAULT_TEMPLATES = [
  { name: 'English', body: 'Your consultation is scheduled for {consultationTime}.' },
  { name: 'Français', body: 'Votre consultation est prevue pour {consultationTime}.' },
  { name: 'Kiswahili', body: 'Ushauri wako umepangwa kwa {consultationTime}.' },
  { name: 'Lingala', body: 'Consultation na yo epangami mpo na {consultationTime}.' },
  { name: 'Kikongo', body: 'Nkanda ya nganga ya mikanda ekozala na {consultationTime}.' },
  { name: 'Tshiluba', body: 'Tshipanganyi tsha nganga tshikaba pa {consultationTime}.' }
];

beforeAll(async () => {
  await setupTests();
  await cleanupTestData();
  seededAdminSessionId = await loginUser(process.env.ADMIN_EMAIL, process.env.ADMIN_EMAIL);
  
  // Set default templates
  await waspOp('update-config', {
    consultationDurationMinutes: 10,
    breakDurationMinutes: 5,
    bufferTimeMinutes: 5,
    consultationSmsTemplates: DEFAULT_TEMPLATES
  }, seededAdminSessionId);
});

afterEach(async () => {
  await cleanupTestData();
  // Reset templates to defaults
  await waspOp('update-config', {
    consultationDurationMinutes: 10,
    breakDurationMinutes: 5,
    bufferTimeMinutes: 5,
    consultationSmsTemplates: DEFAULT_TEMPLATES
  }, seededAdminSessionId);
});

describe('Multi-template SMS Tests', () => {
  describe('Config Template Updates', () => {
    it('should retrieve all templates from config', async () => {
      const configResponse = await waspOp('get-config', {}, seededAdminSessionId);

      expect(configResponse.status).toBe(200);
      const config = configResponse.body.json;
      expect(config.consultationSmsTemplates).toBeDefined();
      expect(Array.isArray(config.consultationSmsTemplates)).toBe(true);
      expect(config.consultationSmsTemplates.length).toBeGreaterThan(0);
      expect(config.consultationSmsTemplates[0]).toHaveProperty('name');
      expect(config.consultationSmsTemplates[0]).toHaveProperty('body');
    });

    it('should use updated template from config', async () => {
      // Update config with custom template
      const customTemplates = [
        { name: 'English', body: 'CUSTOM TEMPLATE: Your appointment is at {consultationTime}' },
        ...DEFAULT_TEMPLATES.slice(1)
      ];
      await waspOp(
        'update-config',
        {
          consultationDurationMinutes: 10,
          breakDurationMinutes: 5,
          bufferTimeMinutes: 5,
          consultationSmsTemplates: customTemplates
        },
        seededAdminSessionId
      );

      const messages = createSmsMessages(1, 7200);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, seededAdminSessionId);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, seededAdminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      // Use the custom template body
      await waspOp(
        'accept-consultation-request',
        { 
          consultationRequestId: request.id, 
          templateBody: customTemplates[0].body,
          assignToOnlyMe: false
        },
        seededAdminSessionId
      );

      const smsResponse = await waspOp('get-sms-messages', { state: 'sending' }, seededAdminSessionId);
      const outgoingSms = smsResponse.body.json.find((msg) => msg.phoneNumber === messages[0].sender);

      expect(outgoingSms).toBeDefined();
      expect(outgoingSms.body).toContain('CUSTOM TEMPLATE');
    });
  });

  describe('Template Selection During Acceptance', () => {
    it('should accept consultation request with English template', async () => {
      const phoneNumber = generatePhoneNumber(7000);
      const messages = createSmsMessages(1, 7000);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, seededAdminSessionId);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, seededAdminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      const englishTemplate = DEFAULT_TEMPLATES.find(t => t.name === 'English');
      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { 
          consultationRequestId: request.id, 
          templateBody: englishTemplate.body,
          assignToOnlyMe: false
        },
        seededAdminSessionId
      );

      expect(acceptResponse.status).toBe(200);
      const consultation = acceptResponse.body.json;
      expect(consultation.id).toBeDefined();
    });

    it('should accept consultation request with French template', async () => {
      const messages = createSmsMessages(1, 7001);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, seededAdminSessionId);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, seededAdminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      const frenchTemplate = DEFAULT_TEMPLATES.find(t => t.name === 'Français');
      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { 
          consultationRequestId: request.id, 
          templateBody: frenchTemplate.body,
          assignToOnlyMe: false
        },
        seededAdminSessionId
      );

      expect(acceptResponse.status).toBe(200);
    });

    it('should accept consultation request with Swahili template', async () => {
      const messages = createSmsMessages(1, 7002);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, seededAdminSessionId);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, seededAdminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      const swahiliTemplate = DEFAULT_TEMPLATES.find(t => t.name === 'Kiswahili');
      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { 
          consultationRequestId: request.id, 
          templateBody: swahiliTemplate.body,
          assignToOnlyMe: false
        },
        seededAdminSessionId
      );

      expect(acceptResponse.status).toBe(200);
    });
  });

  describe('SMS Message Template Verification', () => {
    it('should send SMS with French template when using French template body', async () => {
      const messages = createSmsMessages(1, 7100);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, seededAdminSessionId);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, seededAdminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      const frenchTemplate = DEFAULT_TEMPLATES.find(t => t.name === 'Français');
      await waspOp(
        'accept-consultation-request',
        { 
          consultationRequestId: request.id, 
          templateBody: frenchTemplate.body,
          assignToOnlyMe: false
        },
        seededAdminSessionId
      );

      // Verify outgoing SMS was created
      const smsResponse = await waspOp('get-sms-messages', { state: 'sending' }, seededAdminSessionId);
      const outgoingSms = smsResponse.body.json.find((msg) => msg.phoneNumber === messages[0].sender);

      expect(outgoingSms).toBeDefined();
      expect(outgoingSms.body).toContain('Votre consultation est prevue');
    });

    it('should send SMS with Swahili template when using Swahili template body', async () => {
      const messages = createSmsMessages(1, 7101);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, seededAdminSessionId);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, seededAdminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      const swahiliTemplate = DEFAULT_TEMPLATES.find(t => t.name === 'Kiswahili');
      await waspOp(
        'accept-consultation-request',
        { 
          consultationRequestId: request.id, 
          templateBody: swahiliTemplate.body,
          assignToOnlyMe: false
        },
        seededAdminSessionId
      );

      const smsResponse = await waspOp('get-sms-messages', { state: 'sending' }, seededAdminSessionId);
      const outgoingSms = smsResponse.body.json.find((msg) => msg.phoneNumber === messages[0].sender);

      expect(outgoingSms).toBeDefined();
      expect(outgoingSms.body).toContain('Ushauri wako umepangwa');
    });

    it('should send SMS with English template when using English template body', async () => {
      const messages = createSmsMessages(1, 7102);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, seededAdminSessionId);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, seededAdminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      const englishTemplate = DEFAULT_TEMPLATES.find(t => t.name === 'English');
      await waspOp(
        'accept-consultation-request',
        { 
          consultationRequestId: request.id, 
          templateBody: englishTemplate.body,
          assignToOnlyMe: false
        },
        seededAdminSessionId
      );

      const smsResponse = await waspOp('get-sms-messages', { state: 'sending' }, seededAdminSessionId);
      const outgoingSms = smsResponse.body.json.find((msg) => msg.phoneNumber === messages[0].sender);

      expect(outgoingSms).toBeDefined();
      expect(outgoingSms.body).toContain('Your consultation is scheduled');
    });
  });
});
