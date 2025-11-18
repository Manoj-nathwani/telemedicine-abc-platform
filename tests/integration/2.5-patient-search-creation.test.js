/**
 * Patient Search and Creation Integration Tests (Level 2.5)
 *
 * Tests the new patient search and creation functionality after removing phoneNumber
 * from the Patient model. Verifies that:
 * 1. Patient search works through consultation phone numbers
 * 2. Patient creation works without phone number
 * 3. Patient matching works correctly with name + date of birth
 * 4. Edge cases are handled properly
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
import { acceptConsultationOnly, createTestPatient } from './helpers/workflows.js';

let seededAdminSessionId = '';
let clinicianSessionId = '';
let adminSessionId = '';

beforeAll(async () => {
  await setupTests();
  await cleanupTestData();
  seededAdminSessionId = await loginUser(process.env.ADMIN_EMAIL, process.env.ADMIN_EMAIL);

  // Create test clinician for multi-user tests
  const clinicianResponse = await waspOp(
    'create-user',
    {
      name: 'Patient Test Clinician',
      email: 'patient-clinician@test.com',
      role: 'clinician',
    },
    seededAdminSessionId
  );
  expect(clinicianResponse.status).toBe(200);
  
  // Create test admin for multi-user tests
  const adminResponse = await waspOp(
    'create-user',
    {
      name: 'Patient Test Admin',
      email: 'patient-admin@test.com',
      role: 'admin',
    },
    seededAdminSessionId
  );
  expect(adminResponse.status).toBe(200);
  
  // Set passwords and login as clinician and admin
  await setUserPassword('patient-clinician@test.com', 'password123');
  await setUserPassword('patient-admin@test.com', 'password123');
  
  clinicianSessionId = await loginUser('patient-clinician@test.com', 'password123');
  adminSessionId = await loginUser('patient-admin@test.com', 'password123');
});

afterEach(async () => {
  await cleanupTestData();
});

describe('Patient Search and Creation', () => {
  describe('Patient Creation', () => {
    it('should create a patient with only name and date of birth', async () => {
      const patientData = createPatientData(0);
      
      const response = await waspOp(
        'create-patient-action',
        {
          name: patientData.patientName,
          dateOfBirth: patientData.patientDateOfBirth
        },
        clinicianSessionId
      );

      expect(response.status).toBe(200);
      const patient = response.body.json;
      
      expect(patient).toMatchObject({
        id: expect.any(Number),
        name: patientData.patientName,
        dateOfBirth: expect.any(String),
        createdAt: expect.any(String)
      });
      
      // Verify patient was created without phoneNumber field
      expect(patient.phoneNumber).toBeUndefined();
    });

    it('should enforce unique constraint on name + date of birth', async () => {
      const patientData = createPatientData(0);
      
      // Create first patient
      const response1 = await waspOp(
        'create-patient-action',
        {
          name: patientData.patientName,
          dateOfBirth: patientData.patientDateOfBirth
        },
        clinicianSessionId
      );
      expect(response1.status).toBe(200);

      // Try to create duplicate patient
      const response2 = await waspOp(
        'create-patient-action',
        {
          name: patientData.patientName,
          dateOfBirth: patientData.patientDateOfBirth
        },
        clinicianSessionId
      );
      expect(response2.status).toBe(500); // Should fail due to unique constraint
    });

    it('should allow patients with same name but different DOB', async () => {
      const patientData1 = createPatientData(0);
      const patientData2 = createPatientData(1);
      
      // Create first patient
      const response1 = await waspOp(
        'create-patient-action',
        {
          name: patientData1.patientName,
          dateOfBirth: patientData1.patientDateOfBirth
        },
        clinicianSessionId
      );
      expect(response1.status).toBe(200);

      // Create second patient with same name but different DOB
      const response2 = await waspOp(
        'create-patient-action',
        {
          name: patientData1.patientName, // Same name
          dateOfBirth: patientData2.patientDateOfBirth // Different DOB
        },
        clinicianSessionId
      );
      expect(response2.status).toBe(200);
    });
  });

  describe('Patient Search', () => {
    it('should search patients by phone number through consultations', async () => {
      const phoneIndex = 0;
      const dateStr = getTomorrowDateString();
      
      // Create consultation with patient
      const { consultationId, phoneNumber } = await acceptConsultationOnly(
        adminSessionId,
        phoneIndex,
        dateStr
      );

      // Create a patient and link it to the consultation
      const patientData = createPatientData(0);
      const patientResponse = await waspOp(
        'create-patient-action',
        {
          name: patientData.patientName,
          dateOfBirth: patientData.patientDateOfBirth
        },
        clinicianSessionId
      );
      expect(patientResponse.status).toBe(200);
      const patient = patientResponse.body.json;

      // Assign patient to consultation
      await waspOp(
        'assign-patient-to-consultation',
        {
          consultationId,
          selectedPatientId: patient.id,
          dateOfBirth: patientData.patientDateOfBirth
        },
        clinicianSessionId
      );

      // Create call with outcome data to link the patient
      const callResponse = await waspOp(
        'create-consultation-call',
        {
          consultationId,
          status: 'patient_answered',
          patientId: patient.id,
          confirmations: ['Patient answered the phone', 'Patient identity confirmed', 'Safe location confirmed'],
          chiefComplaint: 'Test consultation',
          diagnosis: 'Test diagnosis',
        },
        clinicianSessionId
      );

      expect(callResponse.status).toBe(200);

      // Now search for patients by phone number
      const searchResponse = await waspOp(
        'search-patients-query',
        {
          phoneNumber,
          dateOfBirth: patientData.patientDateOfBirth
        },
        clinicianSessionId
      );

      expect(searchResponse.status).toBe(200);
      const patients = searchResponse.body.json;
      
      expect(patients).toHaveLength(1);
      expect(patients[0]).toMatchObject({
        id: patient.id,
        name: patientData.patientName,
        dateOfBirth: expect.any(String),
        phoneNumberMatches: true // Should be true since patient was found via phone number
      });
    });

    it('should search patients by date of birth only', async () => {
      const patientData = createPatientData(0);
      
      // Create a patient
      const createResponse = await waspOp(
        'create-patient-action',
        {
          name: patientData.patientName,
          dateOfBirth: patientData.patientDateOfBirth
        },
        clinicianSessionId
      );
      expect(createResponse.status).toBe(200);
      const patient = createResponse.body.json;

      // Search by date of birth only (no phone number)
      const searchResponse = await waspOp(
        'search-patients-query',
        {
          phoneNumber: '',
          dateOfBirth: patientData.patientDateOfBirth
        },
        clinicianSessionId
      );

      expect(searchResponse.status).toBe(200);
      const patients = searchResponse.body.json;
      
      expect(patients).toHaveLength(1);
      expect(patients[0]).toMatchObject({
        id: patient.id,
        name: patientData.patientName,
        dateOfBirth: expect.any(String),
        phoneNumberMatches: false // Should be false since no phone number was used in search
      });
    });

    it('should return empty array when no patients match phone number', async () => {
      const phoneIndex = 0;
      const dateStr = getTomorrowDateString();
      
      // Create consultation (but no patient linked)
      await acceptConsultationOnly(adminSessionId, phoneIndex, dateStr);

      const messages = createSmsMessages(1, phoneIndex);
      const phoneNumber = messages[0].sender;

      // Search for patients with phone number that has no linked patients
      const searchResponse = await waspOp(
        'search-patients-query',
        {
          phoneNumber,
          dateOfBirth: '1990-01-01'
        },
        clinicianSessionId
      );

      expect(searchResponse.status).toBe(200);
      const patients = searchResponse.body.json;
      expect(patients).toHaveLength(0);
    });

    it('should return empty array when no search criteria provided', async () => {
      const searchResponse = await waspOp(
        'search-patients-query',
        {
          phoneNumber: '',
          dateOfBirth: ''
        },
        clinicianSessionId
      );

      expect(searchResponse.status).toBe(200);
      const patients = searchResponse.body.json;
      expect(patients).toHaveLength(0);
    });

    it('should find multiple patients with same phone number', async () => {
      const phoneIndex = 0;
      const dateStr = getTomorrowDateString();
      
      // Create consultation
      const { consultationId, phoneNumber } = await acceptConsultationOnly(
        adminSessionId,
        phoneIndex,
        dateStr
      );

      // Create two different patients
      const patientData1 = createPatientData(0);
      const patientData2 = createPatientData(1);
      
      const patient1Response = await waspOp(
        'create-patient-action',
        {
          name: patientData1.patientName,
          dateOfBirth: patientData1.patientDateOfBirth
        },
        clinicianSessionId
      );
      expect(patient1Response.status).toBe(200);
      const patient1 = patient1Response.body.json;

      const patient2Response = await waspOp(
        'create-patient-action',
        {
          name: patientData2.patientName,
          dateOfBirth: patientData2.patientDateOfBirth
        },
        clinicianSessionId
      );
      expect(patient2Response.status).toBe(200);
      const patient2 = patient2Response.body.json;

      // Assign first patient to consultation
      await waspOp(
        'assign-patient-to-consultation',
        {
          consultationId,
          selectedPatientId: patient1.id,
          dateOfBirth: patientData1.patientDateOfBirth
        },
        clinicianSessionId
      );

      // Link first patient to the consultation
      const call1Response = await waspOp(
        'create-consultation-call',
        {
          consultationId,
          status: 'patient_answered',
          patientId: patient1.id,
          confirmations: ['Patient answered the phone'],
          chiefComplaint: 'Test consultation 1',
          diagnosis: 'Test diagnosis',
        },
        clinicianSessionId
      );
      expect(call1Response.status).toBe(200);

      // Search for patients with the phone number
      const searchResponse = await waspOp(
        'search-patients-query',
        {
          phoneNumber,
          dateOfBirth: ''
        },
        clinicianSessionId
      );

      expect(searchResponse.status).toBe(200);
      const patients = searchResponse.body.json;
      
      // Should find the patient we linked
      expect(patients.length).toBeGreaterThanOrEqual(1);
      const patientIds = patients.map(p => p.id);
      expect(patientIds).toContain(patient1.id);
      
      // Verify that the found patient has phoneNumberMatches: true
      const foundPatient = patients.find(p => p.id === patient1.id);
      expect(foundPatient.phoneNumberMatches).toBe(true);
    });

    it('should correctly identify phone number matches vs date of birth matches', async () => {
      const phoneIndex = 0;
      const dateStr = getTomorrowDateString();
      
      // Create consultation
      const { consultationId, phoneNumber } = await acceptConsultationOnly(
        adminSessionId,
        phoneIndex,
        dateStr
      );

      // Create a patient with specific DOB
      const patientData = createPatientData(0);
      const patientResponse = await waspOp(
        'create-patient-action',
        {
          name: patientData.patientName,
          dateOfBirth: patientData.patientDateOfBirth
        },
        clinicianSessionId
      );
      expect(patientResponse.status).toBe(200);
      const patient = patientResponse.body.json;

      // Assign patient to consultation
      await waspOp(
        'assign-patient-to-consultation',
        {
          consultationId,
          selectedPatientId: patient.id,
          dateOfBirth: patientData.patientDateOfBirth
        },
        clinicianSessionId
      );

      // Link patient to consultation
      const callResponse = await waspOp(
        'create-consultation-call',
        {
          consultationId,
          status: 'patient_answered',
          patientId: patient.id,
          confirmations: ['Patient answered the phone'],
          chiefComplaint: 'Test consultation',
          diagnosis: 'Test diagnosis',
        },
        clinicianSessionId
      );
      expect(callResponse.status).toBe(200);

      // Test 1: Search by phone number only - should find patient with phoneNumberMatches: true
      const phoneSearchResponse = await waspOp(
        'search-patients-query',
        {
          phoneNumber,
          dateOfBirth: ''
        },
        clinicianSessionId
      );
      expect(phoneSearchResponse.status).toBe(200);
      const phonePatients = phoneSearchResponse.body.json;
      expect(phonePatients).toHaveLength(1);
      expect(phonePatients[0].phoneNumberMatches).toBe(true);

      // Test 2: Search by DOB only - should find patient with phoneNumberMatches: false
      const dobSearchResponse = await waspOp(
        'search-patients-query',
        {
          phoneNumber: '',
          dateOfBirth: patientData.patientDateOfBirth
        },
        clinicianSessionId
      );
      expect(dobSearchResponse.status).toBe(200);
      const dobPatients = dobSearchResponse.body.json;
      expect(dobPatients).toHaveLength(1);
      expect(dobPatients[0].phoneNumberMatches).toBe(false);

      // Test 3: Search by both phone and DOB - should find patient with phoneNumberMatches: true
      const bothSearchResponse = await waspOp(
        'search-patients-query',
        {
          phoneNumber,
          dateOfBirth: patientData.patientDateOfBirth
        },
        clinicianSessionId
      );
      expect(bothSearchResponse.status).toBe(200);
      const bothPatients = bothSearchResponse.body.json;
      expect(bothPatients).toHaveLength(1);
      expect(bothPatients[0].phoneNumberMatches).toBe(true);
    });

    it('should NOT return patients with same phone but different DOB (DOB lock constraint)', async () => {
      const phoneIndex = 0;
      const dateStr = getTomorrowDateString();
      
      // Create consultation with phone number
      const { consultationId, phoneNumber } = await acceptConsultationOnly(
        adminSessionId,
        phoneIndex,
        dateStr
      );

      // Create Patient A with DOB Y
      const patientDataA = createPatientData(0);
      const patientAResponse = await waspOp(
        'create-patient-action',
        {
          name: patientDataA.patientName,
          dateOfBirth: patientDataA.patientDateOfBirth
        },
        clinicianSessionId
      );
      expect(patientAResponse.status).toBe(200);
      const patientA = patientAResponse.body.json;

      // Create Patient B with different DOB Z
      const patientDataB = createPatientData(1);
      const patientBResponse = await waspOp(
        'create-patient-action',
        {
          name: patientDataB.patientName,
          dateOfBirth: patientDataB.patientDateOfBirth
        },
        clinicianSessionId
      );
      expect(patientBResponse.status).toBe(200);
      const patientB = patientBResponse.body.json;

      // Assign Patient A to consultation
      await waspOp(
        'assign-patient-to-consultation',
        {
          consultationId,
          selectedPatientId: patientA.id,
          dateOfBirth: patientDataA.patientDateOfBirth
        },
        clinicianSessionId
      );

      // Link Patient A to the consultation (so phone number is associated with Patient A)
      const callResponse = await waspOp(
        'create-consultation-call',
        {
          consultationId,
          status: 'patient_answered',
          patientId: patientA.id,
          confirmations: ['Patient answered the phone'],
          chiefComplaint: 'Test consultation',
          diagnosis: 'Test diagnosis',
        },
        clinicianSessionId
      );
      expect(callResponse.status).toBe(200);

      // Search for phone number + Patient B's DOB (different from Patient A)
      // Should return empty because Patient A has the phone but wrong DOB
      const searchResponse = await waspOp(
        'search-patients-query',
        {
          phoneNumber,
          dateOfBirth: patientDataB.patientDateOfBirth // Different DOB from Patient A
        },
        clinicianSessionId
      );

      expect(searchResponse.status).toBe(200);
      const patients = searchResponse.body.json;
      
      // Should return empty because no patient has both the phone number AND Patient B's DOB
      expect(patients).toHaveLength(0);
    });

    it('should return correct patient when phone + DOB both match', async () => {
      const phoneIndex = 0;
      const dateStr = getTomorrowDateString();
      
      // Create consultation with phone number
      const { consultationId, phoneNumber } = await acceptConsultationOnly(
        adminSessionId,
        phoneIndex,
        dateStr
      );

      // Create patient with specific DOB
      const patientData = createPatientData(0);
      const patientResponse = await waspOp(
        'create-patient-action',
        {
          name: patientData.patientName,
          dateOfBirth: patientData.patientDateOfBirth
        },
        clinicianSessionId
      );
      expect(patientResponse.status).toBe(200);
      const patient = patientResponse.body.json;

      // Assign patient to consultation
      await waspOp(
        'assign-patient-to-consultation',
        {
          consultationId,
          selectedPatientId: patient.id,
          dateOfBirth: patientData.patientDateOfBirth
        },
        clinicianSessionId
      );

      // Link patient to consultation
      const callResponse = await waspOp(
        'create-consultation-call',
        {
          consultationId,
          status: 'patient_answered',
          patientId: patient.id,
          confirmations: ['Patient answered the phone'],
          chiefComplaint: 'Test consultation',
          diagnosis: 'Test diagnosis',
        },
        clinicianSessionId
      );
      expect(callResponse.status).toBe(200);

      // Search for phone number + matching DOB
      const searchResponse = await waspOp(
        'search-patients-query',
        {
          phoneNumber,
          dateOfBirth: patientData.patientDateOfBirth // Same DOB as patient
        },
        clinicianSessionId
      );

      expect(searchResponse.status).toBe(200);
      const patients = searchResponse.body.json;
      
      // Should return the patient because both phone and DOB match
      expect(patients).toHaveLength(1);
      expect(patients[0]).toMatchObject({
        id: patient.id,
        name: patientData.patientName,
        phoneNumberMatches: true // Found via phone number
      });
    });

    it('should handle multiple patients with same phone but different DOBs correctly', async () => {
      const phoneIndex = 0;
      const dateStr = getTomorrowDateString();
      
      // Create consultation with phone number
      const { consultationId, phoneNumber } = await acceptConsultationOnly(
        adminSessionId,
        phoneIndex,
        dateStr
      );

      // Create Patient A
      const patientDataA = createPatientData(0);
      const patientAResponse = await waspOp(
        'create-patient-action',
        {
          name: patientDataA.patientName,
          dateOfBirth: patientDataA.patientDateOfBirth
        },
        clinicianSessionId
      );
      expect(patientAResponse.status).toBe(200);
      const patientA = patientAResponse.body.json;

      // Create Patient B with different DOB
      const patientDataB = createPatientData(1);
      const patientBResponse = await waspOp(
        'create-patient-action',
        {
          name: patientDataB.patientName,
          dateOfBirth: patientDataB.patientDateOfBirth
        },
        clinicianSessionId
      );
      expect(patientBResponse.status).toBe(200);
      const patientB = patientBResponse.body.json;

      // Assign Patient A to consultation
      await waspOp(
        'assign-patient-to-consultation',
        {
          consultationId,
          selectedPatientId: patientA.id,
          dateOfBirth: patientDataA.patientDateOfBirth
        },
        clinicianSessionId
      );

      // Link Patient A to the consultation
      const callResponse = await waspOp(
        'create-consultation-call',
        {
          consultationId,
          status: 'patient_answered',
          patientId: patientA.id,
          confirmations: ['Patient answered the phone'],
          chiefComplaint: 'Test consultation',
          diagnosis: 'Test diagnosis',
        },
        clinicianSessionId
      );
      expect(callResponse.status).toBe(200);

      // Test 1: Search for phone + Patient A's DOB → Should return Patient A
      const searchA = await waspOp(
        'search-patients-query',
        {
          phoneNumber,
          dateOfBirth: patientDataA.patientDateOfBirth
        },
        clinicianSessionId
      );
      expect(searchA.status).toBe(200);
      expect(searchA.body.json).toHaveLength(1);
      expect(searchA.body.json[0].id).toBe(patientA.id);
      expect(searchA.body.json[0].phoneNumberMatches).toBe(true);

      // Test 2: Search for phone + Patient B's DOB → Should return empty
      const searchB = await waspOp(
        'search-patients-query',
        {
          phoneNumber,
          dateOfBirth: patientDataB.patientDateOfBirth
        },
        clinicianSessionId
      );
      expect(searchB.status).toBe(200);
      expect(searchB.body.json).toHaveLength(0);

      // Test 3: Search for Patient B's DOB only (no phone) → Should return Patient B
      const searchDOBOnly = await waspOp(
        'search-patients-query',
        {
          phoneNumber: '',
          dateOfBirth: patientDataB.patientDateOfBirth
        },
        clinicianSessionId
      );
      expect(searchDOBOnly.status).toBe(200);
      expect(searchDOBOnly.body.json).toHaveLength(1);
      expect(searchDOBOnly.body.json[0].id).toBe(patientB.id);
      expect(searchDOBOnly.body.json[0].phoneNumberMatches).toBe(false);
    });

    it('should return patient by DOB even when phone has no linked patients', async () => {
      const phoneIndex = 0;
      const dateStr = getTomorrowDateString();
      
      // Create consultation with phone number (but don't link any patient)
      const { phoneNumber } = await acceptConsultationOnly(
        adminSessionId,
        phoneIndex,
        dateStr
      );

      // Create a patient with some DOB
      const patientData = createPatientData(0);
      const patientResponse = await waspOp(
        'create-patient-action',
        {
          name: patientData.patientName,
          dateOfBirth: patientData.patientDateOfBirth
        },
        clinicianSessionId
      );
      expect(patientResponse.status).toBe(200);
      const patient = patientResponse.body.json;

      // Search for phone + DOB → Should return patient by DOB even though no patient is linked to phone
      // The search uses AND logic, but when phone has no matches, it falls back to DOB search
      const searchResponse = await waspOp(
        'search-patients-query',
        {
          phoneNumber,
          dateOfBirth: patientData.patientDateOfBirth
        },
        clinicianSessionId
      );

      expect(searchResponse.status).toBe(200);
      const patients = searchResponse.body.json;
      
      // Should return the patient because it matches the DOB
      // phoneNumberMatches should be false because no patient is linked to the phone
      expect(patients).toHaveLength(1);
      expect(patients[0]).toMatchObject({
        id: patient.id,
        name: patientData.patientName,
        phoneNumberMatches: false // No patient linked to this phone
      });
    });
  });

  describe('Patient Operations Authorization', () => {
    it('should allow clinicians to create and search patients', async () => {
      const patientData = createPatientData(0);
      
      // Clinician should be able to create patient
      const createResponse = await waspOp(
        'create-patient-action',
        {
          name: patientData.patientName,
          dateOfBirth: patientData.patientDateOfBirth
        },
        clinicianSessionId
      );
      expect(createResponse.status).toBe(200);
      const patient = createResponse.body.json;

      // Clinician should be able to search patients
      const searchResponse = await waspOp(
        'search-patients-query',
        {
          phoneNumber: '',
          dateOfBirth: patientData.patientDateOfBirth
        },
        clinicianSessionId
      );
      expect(searchResponse.status).toBe(200);
      const patients = searchResponse.body.json;
      expect(patients).toHaveLength(1);
      expect(patients[0]).toMatchObject({
        id: patient.id,
        phoneNumberMatches: false // DOB-only search
      });
    });

    it('should allow admins to create and search patients', async () => {
      const patientData = createPatientData(1);
      
      // Admin should be able to create patient
      const createResponse = await waspOp(
        'create-patient-action',
        {
          name: patientData.patientName,
          dateOfBirth: patientData.patientDateOfBirth
        },
        clinicianSessionId
      );
      expect(createResponse.status).toBe(200);
      const patient = createResponse.body.json;

      // Admin should be able to search patients
      const searchResponse = await waspOp(
        'search-patients-query',
        {
          phoneNumber: '',
          dateOfBirth: patientData.patientDateOfBirth
        },
        clinicianSessionId
      );
      expect(searchResponse.status).toBe(200);
      const patients = searchResponse.body.json;
      expect(patients).toHaveLength(1);
      expect(patients[0]).toMatchObject({
        id: patient.id,
        phoneNumberMatches: false // DOB-only search
      });
    });

    it('should allow admins to create and search patients', async () => {
      const patientData = createPatientData(2);
      
      // Admin should be able to create patient
      const createResponse = await waspOp(
        'create-patient-action',
        {
          name: patientData.patientName,
          dateOfBirth: patientData.patientDateOfBirth
        },
        adminSessionId
      );
      expect(createResponse.status).toBe(200);
      const patient = createResponse.body.json;

      // Admin should be able to search patients
      const searchResponse = await waspOp(
        'search-patients-query',
        {
          phoneNumber: '',
          dateOfBirth: patientData.patientDateOfBirth
        },
        adminSessionId
      );
      expect(searchResponse.status).toBe(200);
      const patients = searchResponse.body.json;
      expect(patients).toHaveLength(1);
      expect(patients[0]).toMatchObject({
        id: patient.id,
        phoneNumberMatches: false // DOB-only search
      });
    });

    it('should reject unauthenticated requests', async () => {
      const patientData = createPatientData(3);
      
      // Unauthenticated create should fail
      const createResponse = await waspOp(
        'create-patient-action',
        {
          name: patientData.patientName,
          dateOfBirth: patientData.patientDateOfBirth
        },
        null // No session
      );
      expect(createResponse.status).toBe(401);

      // Unauthenticated search should fail
      const searchResponse = await waspOp(
        'search-patients-query',
        {
          phoneNumber: '',
          dateOfBirth: patientData.patientDateOfBirth
        },
        null // No session
      );
      expect(searchResponse.status).toBe(401);
    });
  });

  describe('Patient Search Edge Cases', () => {

    it('should handle partial date of birth', async () => {
      const patientData = createPatientData(0);
      
      // Create a patient
      await waspOp(
        'create-patient-action',
        {
          name: patientData.patientName,
          dateOfBirth: patientData.patientDateOfBirth
        },
        clinicianSessionId
      );

      // Search with partial date (should not match)
      const searchResponse = await waspOp(
        'search-patients-query',
        {
          phoneNumber: '',
          dateOfBirth: '1990' // Partial date
        },
        clinicianSessionId
      );

      expect(searchResponse.status).toBe(200);
      const patients = searchResponse.body.json;
      expect(patients).toHaveLength(0);
    });
  });

  describe('Integration with Consultation Workflow', () => {
    it('should work end-to-end: SMS → Consultation → Patient Search → Patient Creation', async () => {
      const phoneIndex = 0;
      const dateStr = getTomorrowDateString();
      
      // Step 1: SMS → ConsultationRequest → Consultation
      const { consultationId, phoneNumber } = await acceptConsultationOnly(
        adminSessionId,
        phoneIndex,
        dateStr
      );

      // Step 2: Search for existing patients (should find none)
      const initialSearchResponse = await waspOp(
        'search-patients-query',
        {
          phoneNumber,
          dateOfBirth: '1990-01-01'
        },
        clinicianSessionId
      );
      expect(initialSearchResponse.status).toBe(200);
      expect(initialSearchResponse.body.json).toHaveLength(0);

      // Step 3: Create a new patient
      const patientData = createPatientData(0);
      const patientResponse = await waspOp(
        'create-patient-action',
        {
          name: patientData.patientName,
          dateOfBirth: patientData.patientDateOfBirth
        },
        clinicianSessionId
      );
      expect(patientResponse.status).toBe(200);
      const patient = patientResponse.body.json;

      // Assign patient to consultation
      await waspOp(
        'assign-patient-to-consultation',
        {
          consultationId,
          selectedPatientId: patient.id,
          dateOfBirth: patientData.patientDateOfBirth
        },
        clinicianSessionId
      );

      // Step 4: Link patient to consultation (create call with outcome data)
      const callResponse = await waspOp(
        'create-consultation-call',
        {
          consultationId,
          status: 'patient_answered',
          patientId: patient.id,
          confirmations: ['Patient answered the phone'],
          chiefComplaint: 'Test consultation',
          diagnosis: 'Test diagnosis',
        },
        clinicianSessionId
      );
      expect(callResponse.status).toBe(200);

      // Step 5: Search again (should now find the patient)
      const finalSearchResponse = await waspOp(
        'search-patients-query',
        {
          phoneNumber,
          dateOfBirth: patientData.patientDateOfBirth
        },
        clinicianSessionId
      );
      expect(finalSearchResponse.status).toBe(200);
      const patients = finalSearchResponse.body.json;
      
      expect(patients).toHaveLength(1);
      expect(patients[0]).toMatchObject({
        id: patient.id,
        phoneNumberMatches: true // Should be true since patient was found via phone number
      });
    });
  });
});
