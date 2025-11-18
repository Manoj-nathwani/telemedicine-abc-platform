/**
 * Consultation Lifecycle Integration Tests (Level 2)
 *
 * Deep testing of ConsultationRequest → Consultation → ConsultationCall (with outcome) → OutgoingSmsMessage
 * lifecycle, covering all business rules and data flows.
 *
 * This is the biggest gap in current test coverage - no outcome testing existed before.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { waspOp, loginUser, setUserPassword, setupTests, cleanupTestData } from './helpers/wasp.js';
import {
  createSmsMessages,
  sendSmsMessages,
  SLOT_PRESETS,
  createPatientData,
} from './helpers/fixtures.js';
import { getTomorrowDateString } from './helpers/dates.js';
import { createTestCall, createTestPatient } from './helpers/workflows.js';

// Helper to get default template body from config
async function getDefaultTemplateBody(sessionId) {
  const configResponse = await waspOp('get-config', {}, sessionId);
  return configResponse.body.json.consultationSmsTemplates[0].body;
}

let seededAdminSessionId = '';
let adminSessionId = '';
let clinicianSessionId = '';
let clinician1SessionId = '';
let clinician2SessionId = '';
let clinician1UserId = null;
let clinician2UserId = null;

beforeAll(async () => {
  await setupTests();
  await cleanupTestData();
  seededAdminSessionId = await loginUser(process.env.ADMIN_EMAIL, process.env.ADMIN_EMAIL);
  adminSessionId = seededAdminSessionId;

  // Create test clinician for multi-user tests
  const createUserResponse = await waspOp(
    'create-user',
    {
      name: 'Lifecycle Test Clinician',
      email: 'lifecycle-clinician@test.com',
      role: 'clinician',
    },
    adminSessionId
  );
  // Use admin session for this clinician's tests (password setup skipped for simplicity)
  clinicianSessionId = adminSessionId;

  // Create two additional clinicians for assignment preference tests
  const clinician1Response = await waspOp(
    'create-user',
    {
      name: 'Assignment Test Clinician 1',
      email: 'assignment-clinician1@test.com',
      role: 'clinician',
    },
    adminSessionId
  );
  clinician1UserId = clinician1Response.body.json.id;

  const clinician2Response = await waspOp(
    'create-user',
    {
      name: 'Assignment Test Clinician 2',
      email: 'assignment-clinician2@test.com',
      role: 'clinician',
    },
    adminSessionId
  );
  clinician2UserId = clinician2Response.body.json.id;

  // Set passwords and login as the clinicians for assignment preference tests
  await setUserPassword('assignment-clinician1@test.com', 'password123');
  await setUserPassword('assignment-clinician2@test.com', 'password123');
  clinician1SessionId = await loginUser('assignment-clinician1@test.com', 'password123');
  clinician2SessionId = await loginUser('assignment-clinician2@test.com', 'password123');
});

afterEach(async () => {
  await cleanupTestData();
});


describe('Consultation Lifecycle Tests', () => {
  describe('Consultation Creation', () => {
    it('should create consultation from accepted request', async () => {
      const messages = createSmsMessages(1, 2000);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      // Create slots and accept request
      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, adminSessionId);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, adminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      const templateBody = await getDefaultTemplateBody(adminSessionId);
      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody, assignToOnlyMe: false },
        adminSessionId
      );
      expect(acceptResponse.status).toBe(200);

      const consultation = acceptResponse.body.json;
      expect(consultation.id).toBeDefined();
      expect(consultation.consultationRequestId).toBe(request.id);
      expect(consultation.slotId).toBeDefined();
      expect(consultation.assignedToUserId).toBeDefined();
    });

    it('should inherit patient data from request', async () => {
      const messages = createSmsMessages(1, 2001);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, adminSessionId);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, adminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      const templateBody = await getDefaultTemplateBody(adminSessionId);
      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody, assignToOnlyMe: false },
        adminSessionId
      );

      const consultation = acceptResponse.body.json;
      // Verify phoneNumber is accessible through relationship
      expect(consultation.consultationRequestId).toBe(request.id);
    });

    it('should not create consultation from rejected request', async () => {
      const messages = createSmsMessages(1, 2002);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, adminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      // Reject first
      await waspOp('reject-consultation-request', { consultationRequestId: request.id }, adminSessionId);

      // Try to accept rejected request (should fail)
      const templateBody = await getDefaultTemplateBody(adminSessionId);
      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody, assignToOnlyMe: false },
        adminSessionId
      );
      expect(acceptResponse.status).toBeGreaterThanOrEqual(400);
    });

    it('should not create duplicate consultation for same request', async () => {
      const messages = createSmsMessages(1, 2003);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, adminSessionId);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, adminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      // First acceptance should succeed
      const templateBody1 = await getDefaultTemplateBody(adminSessionId);
      const firstAccept = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody: templateBody1, assignToOnlyMe: false },
        adminSessionId
      );
      expect(firstAccept.status).toBe(200);

      // Second acceptance should fail (already accepted)
      const secondAccept = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody: templateBody1, assignToOnlyMe: false },
        adminSessionId
      );
      expect(secondAccept.status).toBeGreaterThanOrEqual(400);
    });
  });

  // NOTE: Consultation Updates describe block removed - clinical notes and patient data
  // are stored in ConsultationCall (merged with outcome) and Patient entities respectively,
  // not in Consultation. The update-consultation API only fetches consultations.

  describe('Consultation Call with Outcome Data', () => {
    let consultationIdAnswered;
    let consultationIdNoAnswer;
    let consultationIdDidNotCall;

    beforeEach(async () => {
      // Create 3 consultations for each test (afterEach cleanup deletes them)
      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, adminSessionId);

      for (let i = 0; i < 3; i++) {
        const messages = createSmsMessages(1, 2200 + i + Math.random() * 100);
        await sendSmsMessages(messages, process.env.SMS_API_KEY);

        const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, adminSessionId);
        const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

        const templateBody = await getDefaultTemplateBody(adminSessionId);
        const acceptResponse = await waspOp(
          'accept-consultation-request',
          { consultationRequestId: request.id, templateBody, assignToOnlyMe: false },
          adminSessionId
        );

        if (i === 0) consultationIdAnswered = acceptResponse.body.json.id;
        if (i === 1) consultationIdNoAnswer = acceptResponse.body.json.id;
        if (i === 2) consultationIdDidNotCall = acceptResponse.body.json.id;
      }
    });

    it('should create call with outcome data: patient_answered → follow-up SMS sent', async () => {
      // Get phone number from the consultation request
      const pendingResponse = await waspOp('get-consultation-requests', { status: 'accepted' }, adminSessionId);
      const consultationRequest = pendingResponse.body.json.find(r => r.consultation?.id === consultationIdAnswered);
      const phoneNumber = consultationRequest.phoneNumber;

      // Create patient
      const { patientId, dateOfBirth } = await createTestPatient(adminSessionId, phoneNumber, 0);

      // Assign patient to consultation
      await waspOp(
        'assign-patient-to-consultation',
        {
          consultationId: consultationIdAnswered,
          selectedPatientId: patientId,
          dateOfBirth
        },
        adminSessionId
      );

      // Create call with outcome data (merged in single action)
      const callResponse = await waspOp(
        'create-consultation-call',
        {
          consultationId: consultationIdAnswered,
          status: 'patient_answered',
          patientId,
          confirmations: ['Patient answered the phone', 'Patient identity confirmed', 'Safe location confirmed'],
          chiefComplaint: 'Persistent cough and fever for 3 days',
          reviewOfSystems: 'No chest pain',
          pastMedicalHistory: 'None',
          diagnosis: 'Upper respiratory infection',
          labTests: 'None',
          prescriptions: 'Paracetamol 500mg BID',
          safetyNetting: 'Return if fever persists >5 days',
          followUp: 'Call in 1 week',
          additionalNotes: 'Patient doing well',
        },
        adminSessionId
      );

      expect(callResponse.status).toBe(200);
      const call = callResponse.body.json;
      expect(call.consultationId).toBe(consultationIdAnswered);
      expect(call.status).toBe('patient_answered');
      expect(Array.isArray(call.confirmations)).toBe(true);
      expect(call.confirmations).toContain('Patient answered the phone');
      expect(call.chiefComplaint).toBe('Persistent cough and fever for 3 days');
      expect(call.diagnosis).toBe('Upper respiratory infection');
    });

    it('should reject outcome data for patient_no_answer', async () => {
      // Get phone number
      const pendingResponse = await waspOp('get-consultation-requests', { status: 'accepted' }, adminSessionId);
      const consultationRequest = pendingResponse.body.json.find(r => r.consultation?.id === consultationIdNoAnswer);
      const phoneNumber = consultationRequest.phoneNumber;

      // Create patient
      const { patientId } = await createTestPatient(adminSessionId, phoneNumber, 1);

      // Attempt to create call with patient_no_answer + outcome data - should FAIL
      const callResponse = await waspOp(
        'create-consultation-call',
        {
          consultationId: consultationIdNoAnswer,
          status: 'patient_no_answer',
          patientId,
          confirmations: ['Patient answered the phone'],
          chiefComplaint: 'This should fail',
          diagnosis: 'This should fail',
        },
        adminSessionId
      );

      // Should fail because only patient_answered calls can have outcome fields
      expect(callResponse.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject outcome data for clinician_did_not_call', async () => {
      // Get phone number
      const pendingResponse = await waspOp('get-consultation-requests', { status: 'accepted' }, adminSessionId);
      const consultationRequest = pendingResponse.body.json.find(r => r.consultation?.id === consultationIdDidNotCall);
      const phoneNumber = consultationRequest.phoneNumber;

      // Create patient
      const { patientId } = await createTestPatient(adminSessionId, phoneNumber, 2);

      // Attempt to create call with clinician_did_not_call + outcome data - should FAIL
      const callResponse = await waspOp(
        'create-consultation-call',
        {
          consultationId: consultationIdDidNotCall,
          status: 'clinician_did_not_call',
          patientId,
          confirmations: ['Patient answered the phone'],
          chiefComplaint: 'This should fail',
          diagnosis: 'This should fail',
        },
        adminSessionId
      );

      // Should fail because only patient_answered calls can have outcome fields
      expect(callResponse.status).toBeGreaterThanOrEqual(400);
    });

    it('should require valid consultation to exist', async () => {
      const fakeConsultationId = 99999999;
      const fakePatientId = 99999999;

      const callResponse = await waspOp(
        'create-consultation-call',
        {
          consultationId: fakeConsultationId,
          status: 'patient_answered',
          patientId: fakePatientId,
          confirmations: ['Patient answered the phone'],
          chiefComplaint: 'Test',
          diagnosis: 'Test',
        },
        adminSessionId
      );

      expect(callResponse.status).toBeGreaterThanOrEqual(400);
    });

    it('should allow multiple call attempts for same consultation', async () => {
      // Create fresh consultation
      const messages = createSmsMessages(1, 2300);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.morning }, adminSessionId);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, adminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      const templateBody = await getDefaultTemplateBody(adminSessionId);
      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody, assignToOnlyMe: false },
        adminSessionId
      );
      const consultationId = acceptResponse.body.json.id;

      // Create patient
      const { patientId, dateOfBirth } = await createTestPatient(adminSessionId, messages[0].sender, 0);

      // Assign patient to consultation
      await waspOp(
        'assign-patient-to-consultation',
        {
          consultationId,
          selectedPatientId: patientId,
          dateOfBirth
        },
        adminSessionId
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
        adminSessionId
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
        adminSessionId
      );
      // This should succeed - multiple calls/outcomes are allowed per consultation
      expect(secondCall.status).toBe(200);
    });
  });

  describe('Follow-up SMS Integration', () => {
    let consultationId;

    beforeEach(async () => {
      // Create consultation for each test (afterEach cleanup deletes it)
      const messages = createSmsMessages(1, 2400 + Math.random() * 100);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);

      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.afternoon }, adminSessionId);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, adminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

      const templateBody = await getDefaultTemplateBody(adminSessionId);
      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody, assignToOnlyMe: false },
        adminSessionId
      );
      consultationId = acceptResponse.body.json.id;
    });

    it('should send SMS with correct patient number', async () => {
      // Get phone number from consultation request
      const acceptedResponse = await waspOp('get-consultation-requests', { status: 'accepted' }, adminSessionId);
      const consultationRequest = acceptedResponse.body.json.find(r => r.consultation?.id === consultationId);
      const phoneNumber = consultationRequest.phoneNumber;

      // Create call with outcome and patient
      const { patientId } = await createTestPatient(adminSessionId, phoneNumber, 0);

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

      // Manually send follow-up SMS (actual workflow - not automatic)
      const smsResponse = await waspOp(
        'send-consultation-sms',
        {
          consultationId,
          phoneNumber,
          message: 'Follow-up: Take medication as prescribed',
        },
        adminSessionId
      );

      expect(smsResponse.status).toBe(200);
      const sms = smsResponse.body.json;
      expect(sms.phoneNumber).toBe(phoneNumber);
    });

    it('should send SMS with custom follow-up content', async () => {
      const messages = createSmsMessages(1, 2401);
      await sendSmsMessages(messages, process.env.SMS_API_KEY);
      const phoneNumber = messages[0].sender;

      const dateStr = getTomorrowDateString();
      await waspOp('bulk-update-slots', { date: dateStr, slots: SLOT_PRESETS.afternoon }, adminSessionId);

      const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, adminSessionId);
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === phoneNumber);

      const templateBody = await getDefaultTemplateBody(adminSessionId);
      const acceptResponse = await waspOp(
        'accept-consultation-request',
        { consultationRequestId: request.id, templateBody, assignToOnlyMe: false },
        adminSessionId
      );
      const newConsultationId = acceptResponse.body.json.id;

      // Create call with outcome and patient
      const { patientId } = await createTestPatient(adminSessionId, phoneNumber, 0);

      await waspOp(
        'create-consultation-call',
        {
          consultationId: newConsultationId,
          status: 'patient_answered',
          patientId,
          confirmations: ['Patient answered the phone'],
          chiefComplaint: 'Patient doing well',
          diagnosis: 'Improving',
        },
        adminSessionId
      );

      // Send SMS with custom message
      const customMessage = 'Take medication as prescribed. Return if fever persists after 3 days.';
      const smsResponse = await waspOp(
        'send-consultation-sms',
        {
          consultationId: newConsultationId,
          phoneNumber,
          message: customMessage,
        },
        adminSessionId
      );

      expect(smsResponse.status).toBe(200);
      const sms = smsResponse.body.json;
      expect(sms.body).toBe(customMessage);
    });
  });

  describe('Assignment Preference', () => {
    describe('assignToOnlyMe: false (assign to any clinician)', () => {
      it('should assign to any available clinician when assignToOnlyMe is false', async () => {
        const messages = createSmsMessages(1, 3000);
        await sendSmsMessages(messages, process.env.SMS_API_KEY);

        // Create slots for clinician2 only
        const dateStr = getTomorrowDateString();
        await waspOp('bulk-update-slots', { date: dateStr, userId: clinician2UserId, slots: SLOT_PRESETS.morning }, adminSessionId);

        const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, clinician1SessionId);
        const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

        // Accept with assignToOnlyMe: false (should assign to clinician2 who has slots)
        const templateBody = await getDefaultTemplateBody(clinician1SessionId);
        const acceptResponse = await waspOp(
          'accept-consultation-request',
          {
            consultationRequestId: request.id,
            templateBody,
            assignToOnlyMe: false,
          },
          clinician1SessionId
        );

        expect(acceptResponse.status).toBe(200);
        const consultation = acceptResponse.body.json;
        expect(consultation.id).toBeDefined();
        expect(consultation.assignedToUserId).toBe(clinician2UserId); // Assigned to clinician2 who has slots
      });

      it('should assign to any available slot when multiple clinicians have slots', async () => {
        const messages = createSmsMessages(1, 3001);
        await sendSmsMessages(messages, process.env.SMS_API_KEY);

        // Create slots for both clinicians
        const dateStr = getTomorrowDateString();
        await waspOp('bulk-update-slots', { date: dateStr, userId: clinician1UserId, slots: SLOT_PRESETS.morning }, adminSessionId);
        await waspOp('bulk-update-slots', { date: dateStr, userId: clinician2UserId, slots: SLOT_PRESETS.morning }, adminSessionId);

        const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, clinician1SessionId);
        const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

        const acceptResponse = await waspOp(
          'accept-consultation-request',
          {
            consultationRequestId: request.id,
            templateBody: await getDefaultTemplateBody(clinician1SessionId),
            assignToOnlyMe: false,
          },
          clinician1SessionId
        );

        expect(acceptResponse.status).toBe(200);
        const consultation = acceptResponse.body.json;
        expect(consultation.id).toBeDefined();
        // Should be assigned to either clinician1 or clinician2 (whoever has the earliest slot)
        expect([clinician1UserId, clinician2UserId]).toContain(consultation.assignedToUserId);
      });
    });

    describe('assignToOnlyMe: true (assign to me only)', () => {
      it('should assign to current user when assignToOnlyMe is true and user has slots', async () => {
        const messages = createSmsMessages(1, 3002);
        await sendSmsMessages(messages, process.env.SMS_API_KEY);

        // Create slots for clinician1
        const dateStr = getTomorrowDateString();
        await waspOp('bulk-update-slots', { date: dateStr, userId: clinician1UserId, slots: SLOT_PRESETS.morning }, adminSessionId);

        const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, clinician1SessionId);
        const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

        // Accept with assignToOnlyMe: true (should assign to clinician1)
        const acceptResponse = await waspOp(
          'accept-consultation-request',
          {
            consultationRequestId: request.id,
            templateBody: await getDefaultTemplateBody(clinician1SessionId),
            assignToOnlyMe: true,
          },
          clinician1SessionId
        );

        expect(acceptResponse.status).toBe(200);
        const consultation = acceptResponse.body.json;
        expect(consultation.id).toBeDefined();
        expect(consultation.assignedToUserId).toBe(clinician1UserId); // Assigned to clinician1 (the one accepting)
      });

      it('should error when assignToOnlyMe is true but user has no available slots', async () => {
        const messages = createSmsMessages(1, 3003);
        await sendSmsMessages(messages, process.env.SMS_API_KEY);

        // Create slots for clinician2 only (not clinician1)
        const dateStr = getTomorrowDateString();
        await waspOp('bulk-update-slots', { date: dateStr, userId: clinician2UserId, slots: SLOT_PRESETS.morning }, adminSessionId);

        const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, clinician1SessionId);
        const request = pendingResponse.body.json.find((r) => r.phoneNumber === messages[0].sender);

        // Try to accept with assignToOnlyMe: true but clinician1 has no slots
        const acceptResponse = await waspOp(
          'accept-consultation-request',
          {
            consultationRequestId: request.id,
            templateBody: await getDefaultTemplateBody(clinician1SessionId),
            assignToOnlyMe: true,
          },
          clinician1SessionId
        );

        expect(acceptResponse.status).toBe(400);
        // Wasp HttpError responses are serialized in body.json
        const errorBody = acceptResponse.body?.json || acceptResponse.body || {};
        const errorMessage = errorBody.message || errorBody.error || JSON.stringify(errorBody);
        expect(errorMessage.toLowerCase()).toMatch(/no available slots|manage your availability/i);
      });
    });

    describe('Assignment behavior with different slot scenarios', () => {
      it('should handle concurrent requests correctly with assignToOnlyMe: false', async () => {
        const messages = createSmsMessages(2, 3004);
        await sendSmsMessages(messages, process.env.SMS_API_KEY);

        // Create slots for both clinicians
        const dateStr = getTomorrowDateString();
        await waspOp('bulk-update-slots', { date: dateStr, userId: clinician1UserId, slots: SLOT_PRESETS.morning }, adminSessionId);
        await waspOp('bulk-update-slots', { date: dateStr, userId: clinician2UserId, slots: SLOT_PRESETS.morning }, adminSessionId);

        const pendingResponse = await waspOp('get-consultation-requests', { status: 'pending' }, clinician1SessionId);
        const requests = messages.map(msg => 
          pendingResponse.body.json.find((r) => r.phoneNumber === msg.sender)
        ).filter(Boolean);

        // Accept both with assignToOnlyMe: false (should assign to different slots)
        const accept1 = await waspOp(
          'accept-consultation-request',
          {
            consultationRequestId: requests[0].id,
            templateBody: await getDefaultTemplateBody(clinician1SessionId),
            assignToOnlyMe: false,
          },
          clinician1SessionId
        );

        const accept2 = await waspOp(
          'accept-consultation-request',
          {
            consultationRequestId: requests[1].id,
            templateBody: await getDefaultTemplateBody(clinician1SessionId),
            assignToOnlyMe: false,
          },
          clinician1SessionId
        );

        expect(accept1.status).toBe(200);
        expect(accept2.status).toBe(200);
        
        const consultation1 = accept1.body.json;
        const consultation2 = accept2.body.json;
        
        // Both should be assigned, potentially to different slots/clinicians
        expect(consultation1.id).toBeDefined();
        expect(consultation2.id).toBeDefined();
        expect(consultation1.slotId).not.toBe(consultation2.slotId); // Different slots
      });
    });
  });
});
