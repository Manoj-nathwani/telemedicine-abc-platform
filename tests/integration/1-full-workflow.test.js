/**
 * Full Workflow Integration Tests (Level 1)
 *
 * End-to-end tests covering complete telemedicine workflows from SMS intake
 * to consultation completion. Tests real API endpoints with real database operations.
 *
 * These are smoke tests - if these pass, the app fundamentally works.
 *
 * Test Isolation: Uses testContext with timestamp-based unique dates/phones
 *
 * See tests/integration/README.md for testing philosophy and guidelines.
 * Run: npm test
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { waspOp, loginUser, setUserPassword, setupTests, cleanupTestData } from './helpers/wasp.js';
import { generateTestEmail } from './helpers/fixtures.js';
import { getTomorrowDateString } from './helpers/dates.js';
import {
  completeConsultationWorkflow,
  acceptConsultationOnly,
  createTestCall,
  createTestPatient,
  createMultipleRequests,
} from './helpers/workflows.js';

let seededAdminSessionId = '';
let adminSessionId = '';
let clinicianSessionId = '';
let clinicianEmail = '';

beforeAll(async () => {
  await setupTests();
  
  seededAdminSessionId = await loginUser(process.env.ADMIN_EMAIL, process.env.ADMIN_EMAIL);
  adminSessionId = seededAdminSessionId;
});

afterEach(async () => {

  await cleanupTestData();
});


describe('Full Workflow Tests', () => {
  describe('Complete Patient Journey', () => {
    it('should complete full consultation workflow', async () => {
      // SMS → Request → Accept → Patient → Call → Outcome
      const result = await completeConsultationWorkflow(adminSessionId, 1000, getTomorrowDateString());

      // Verify all IDs are defined
      expect(result.consultationId).toBeDefined();
      expect(result.callId).toBeDefined();
      expect(result.patientId).toBeDefined();
      expect(result.phoneNumber).toBeDefined();

      // Verify the consultation shows in accepted tab with all details
      const acceptedResponse = await waspOp(
        'get-consultation-requests',
        { status: 'accepted' },
        adminSessionId
      );
      expect(acceptedResponse.status).toBe(200);

      const acceptedRequest = acceptedResponse.body.json.find(
        (r) => r.phoneNumber === result.phoneNumber
      );
      expect(acceptedRequest).toBeDefined();
      expect(acceptedRequest.status).toBe('accepted');
      expect(acceptedRequest.consultation).toBeDefined();
      expect(acceptedRequest.consultation.slot).toBeDefined();
    });

    it('should reject a consultation request', async () => {
      // Create a request to reject
      const phoneNumbers = await createMultipleRequests(1, 1001);
      const phoneNumber = phoneNumbers[0];

      // Get the request
      const pendingResponse = await waspOp(
        'get-consultation-requests',
        { status: 'pending' },
        adminSessionId
      );
      const request = pendingResponse.body.json.find((r) => r.phoneNumber === phoneNumber);
      expect(request).toBeDefined();

      // Reject it
      const rejectResponse = await waspOp(
        'reject-consultation-request',
        { consultationRequestId: request.id },
        adminSessionId
      );
      expect(rejectResponse.status).toBe(200);

      // Verify it shows in rejected tab
      const rejectedResponse = await waspOp(
        'get-consultation-requests',
        { status: 'rejected' },
        adminSessionId
      );
      const rejectedRequest = rejectedResponse.body.json.find((r) => r.id === request.id);
      expect(rejectedRequest).toBeDefined();
      expect(rejectedRequest.status).toBe('rejected');
    });
  });

  describe('User Management Flow', () => {
    it('should create clinician → set password → login → complete full workflow', async () => {
      // Step 1: Admin creates new clinician
      clinicianEmail = generateTestEmail('clinician');
      const createUserResponse = await waspOp(
        'create-user',
        {
          name: 'Test Clinician',
          email: clinicianEmail,
          role: 'clinician',
        },
        adminSessionId
      );
      expect(createUserResponse.status).toBe(200);
      const user = createUserResponse.body.json;
      expect(user.role).toBe('clinician');

      // Step 2: Set password and login
      await setUserPassword(clinicianEmail, 'clinician123');
      clinicianSessionId = await loginUser(clinicianEmail, 'clinician123');
      expect(clinicianSessionId).toBeDefined();

      // Step 3: Clinician completes full consultation workflow with their own account
      const result = await completeConsultationWorkflow(
        clinicianSessionId,
        1002,
        getTomorrowDateString()
      );

      // Verify all steps completed successfully
      expect(result.consultationId).toBeDefined();
      expect(result.callId).toBeDefined();
      expect(result.patientId).toBeDefined();

      // Verify clinician can see their own consultation
      const consultationResponse = await waspOp(
        'get-consultation-with-calls',
        { consultationId: result.consultationId },
        clinicianSessionId
      );
      expect(consultationResponse.status).toBe(200);
      expect(consultationResponse.body.json.id).toBe(result.consultationId);

      // Verify new clinician appears in users list
      const usersResponse = await waspOp('get-users', {}, adminSessionId);
      expect(usersResponse.status).toBe(200);

      const users = usersResponse.body.json;
      const clinician = users.find((u) => u.email === clinicianEmail);
      expect(clinician).toBeDefined();
      expect(clinician.role).toBe('clinician');
    });
  });

  describe('Call Status Variations', () => {
    it('should handle patient_no_answer scenario (no outcome fields)', async () => {
      // Accept consultation
      const { consultationId, phoneNumber } = await acceptConsultationOnly(
        adminSessionId,
        1003,
        getTomorrowDateString()
      );

      // Create call with patient_no_answer (no outcome fields)
      const { callId } = await createTestCall(adminSessionId, consultationId, 'patient_no_answer');
      expect(callId).toBeDefined();

      // Verify call was created without outcome fields
      const patient = await createTestPatient(adminSessionId, phoneNumber, 0);

      // Attempting to create call with patient_no_answer status + outcome fields should fail
      const callWithOutcomeResponse = await waspOp(
        'create-consultation-call',
        {
          consultationId,
          status: 'patient_no_answer',
          patientId: patient.patientId,
          confirmations: ['Patient answered the phone'],
          chiefComplaint: 'This should fail',
          diagnosis: 'This should fail',
        },
        adminSessionId
      );

      // Should fail because only patient_answered calls can have outcome fields
      expect(callWithOutcomeResponse.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle clinician_did_not_call scenario (no outcome fields)', async () => {
      // Accept consultation
      const { consultationId, phoneNumber } = await acceptConsultationOnly(
        adminSessionId,
        1004,
        getTomorrowDateString()
      );

      // Create call with clinician_did_not_call (no outcome fields)
      const { callId } = await createTestCall(adminSessionId, consultationId, 'clinician_did_not_call');
      expect(callId).toBeDefined();

      // Verify call was created without outcome fields
      const patient = await createTestPatient(adminSessionId, phoneNumber, 0);

      // Attempting to create call with clinician_did_not_call status + outcome fields should fail
      const callWithOutcomeResponse = await waspOp(
        'create-consultation-call',
        {
          consultationId,
          status: 'clinician_did_not_call',
          patientId: patient.patientId,
          confirmations: ['Patient answered the phone'],
          chiefComplaint: 'This should fail',
          diagnosis: 'This should fail',
        },
        adminSessionId
      );

      // Should fail
      expect(callWithOutcomeResponse.status).toBeGreaterThanOrEqual(400);
    });
  });
});
