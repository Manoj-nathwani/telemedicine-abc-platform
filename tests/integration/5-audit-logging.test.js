/**
 * Audit Logging Integration Tests (Level 5)
 *
 * Tests audit trail functionality - verifies all user actions are logged for compliance.
 *
 * Phone number range: 8000-8099
 *
 * Run: npm test
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { waspOp, loginUser, setupTests, cleanupTestData } from './helpers/wasp.js';
import { generatePhoneNumber } from './helpers/fixtures.js';

let seededAdminSessionId = '';
let userId = null;
let phoneCounter = 8000;

const getPhone = () => generatePhoneNumber(phoneCounter++);

beforeAll(async () => {
  await setupTests();
  await cleanupTestData();
  seededAdminSessionId = await loginUser(process.env.ADMIN_EMAIL, process.env.ADMIN_EMAIL);

  // Get the user ID
  const userResponse = await waspOp('get-user', {}, seededAdminSessionId);
  userId = userResponse.body.json.id;
});

afterEach(async () => {
  await cleanupTestData();
});

describe('Audit Logging Tests', () => {

  it('should create audit log when user updates config', async () => {
    // Update config (this should create an audit log)
    const updateResult = await waspOp('update-config', {
      consultationDurationMinutes: 30,
      breakDurationMinutes: 10,
      bufferTimeMinutes: 5,
      consultationSmsTemplates: [
        { name: 'English', body: 'Your consultation is scheduled for {consultationTime}.' }
      ]
    }, seededAdminSessionId);

    expect(updateResult.status).toBe(200);

    // Wait for audit log to be created (it's async)
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check if audit log was created
    const auditLogsResponse = await waspOp('get-audit-logs-by-user', {
      userId: userId
    }, seededAdminSessionId);

    expect(auditLogsResponse.status).toBe(200);
    const logs = auditLogsResponse.body.json;

    // Check for a Config UPDATE log
    const configLog = logs.find(log =>
      log.entityType === 'Config' && log.eventType === 'UPDATE'
    );

    expect(configLog).toBeDefined();
    expect(configLog.actorUserId).toBe(userId);
  });

  it('should create audit log when user is created', async () => {
    const createUserResult = await waspOp('create-user', {
      name: 'Audit Test User',
      email: 'audittest@example.com',
      role: 'clinician'
    }, seededAdminSessionId);

    expect(createUserResult.status).toBe(200);
    const newUserId = createUserResult.body.json.id;

    await new Promise(resolve => setTimeout(resolve, 500));

    const auditLogsResponse = await waspOp('get-audit-logs-by-user', {
      userId: userId
    }, seededAdminSessionId);

    expect(auditLogsResponse.status).toBe(200);
    const logs = auditLogsResponse.body.json;

    // Check for User CREATE log
    const userLog = logs.find(log =>
      log.entityType === 'User' &&
      log.eventType === 'CREATE' &&
      log.entityId === newUserId
    );

    expect(userLog).toBeDefined();
    expect(userLog.actorUserId).toBe(userId);
    expect(userLog.changedFields?.changes?.name).toBe('Audit Test User');
    expect(userLog.changedFields?.changes?.role).toBe('clinician');
    // Email is stored in nested auth.create structure, not as a direct field
    expect(userLog.changedFields?.changes?.auth).toBeDefined();
  });

  it('should create audit log when user role is updated', async () => {
    // Create a user first
    const createUserResult = await waspOp('create-user', {
      name: 'Role Update Test',
      email: 'roleupdate@example.com',
      role: 'clinician'
    }, seededAdminSessionId);

    expect(createUserResult.status).toBe(200);
    const targetUserId = createUserResult.body.json.id;

    // Update their role
    const updateRoleResult = await waspOp('update-user-role', {
      userId: targetUserId,
      role: 'admin'
    }, seededAdminSessionId);

    expect(updateRoleResult.status).toBe(200);

    await new Promise(resolve => setTimeout(resolve, 500));

    const auditLogsResponse = await waspOp('get-audit-logs-by-user', {
      userId: userId
    }, seededAdminSessionId);

    expect(auditLogsResponse.status).toBe(200);
    const logs = auditLogsResponse.body.json;

    // Check for User UPDATE log
    const roleUpdateLog = logs.find(log =>
      log.entityType === 'User' &&
      log.eventType === 'UPDATE' &&
      log.entityId === targetUserId
    );

    expect(roleUpdateLog).toBeDefined();
    expect(roleUpdateLog.actorUserId).toBe(userId);
    expect(roleUpdateLog.changedFields?.changes?.role).toBe('admin');
  });

  it('should create audit logs for consultation workflow', async () => {
    const { createSms, getTomorrowDate, createSlots } = await import('./helpers/fixtures.js');

    // Create slots for the user
    await createSlots(seededAdminSessionId, userId, getTomorrowDate());

    // Create SMS -> ConsultationRequest
    const phoneNumber = getPhone();
    await createSms(phoneNumber, 'Test symptoms');

    await new Promise(resolve => setTimeout(resolve, 500));

    // Get consultation requests - find the one we just created
    const requestsResponse = await waspOp('get-consultation-requests', {}, seededAdminSessionId);
    expect(requestsResponse.status).toBe(200);
    const requests = requestsResponse.body.json;
    const ourRequest = requests.find(r => r.phoneNumber === phoneNumber);
    expect(ourRequest).toBeDefined();

    // Get template from config
    const configResponse = await waspOp('get-config', {}, seededAdminSessionId);
    const templateBody = configResponse.body.json.consultationSmsTemplates[0].body;

    // Accept the request (creates Consultation)
    const acceptResult = await waspOp('accept-consultation-request', {
      consultationRequestId: ourRequest.id,
      templateBody,
      assignToOnlyMe: false
    }, seededAdminSessionId);

    expect(acceptResult.status).toBe(200);
    const consultation = acceptResult.body.json;

    await new Promise(resolve => setTimeout(resolve, 500));

    // Check audit logs
    const auditLogsResponse = await waspOp('get-audit-logs-by-user', {
      userId: userId
    }, seededAdminSessionId);

    expect(auditLogsResponse.status).toBe(200);
    const logs = auditLogsResponse.body.json;

    // Should have logs for:
    // - Slot CREATE
    const slotLog = logs.find(log =>
      log.entityType === 'Slot' && log.eventType === 'CREATE'
    );
    expect(slotLog).toBeDefined();
    expect(slotLog.changedFields?.changes).toBeDefined();
    // Slot create includes startDateTime, endDateTime, and userId
    expect(slotLog.changedFields?.changes?.startDateTime).toBeDefined();

    // - Consultation CREATE
    const consultationLog = logs.find(log =>
      log.entityType === 'Consultation' &&
      log.eventType === 'CREATE' &&
      log.entityId === consultation.id
    );
    expect(consultationLog).toBeDefined();
    expect(consultationLog.changedFields?.changes).toBeDefined();
    // Consultation data is logged (may use connect syntax for relations)
    expect(Object.keys(consultationLog.changedFields.changes).length).toBeGreaterThan(0);

    // - ConsultationRequest UPDATE (status changed to accepted)
    const requestUpdateLog = logs.find(log =>
      log.entityType === 'ConsultationRequest' &&
      log.eventType === 'UPDATE' &&
      log.entityId === ourRequest.id
    );
    expect(requestUpdateLog).toBeDefined();
    expect(requestUpdateLog.changedFields?.changes?.status).toBe('accepted');

    // All should be attributed to the logged-in user
    expect(slotLog.actorUserId).toBe(userId);
    expect(consultationLog.actorUserId).toBe(userId);
    expect(requestUpdateLog.actorUserId).toBe(userId);
  });

  it('should create audit logs for patient and call creation', async () => {
    const { getTomorrowDateString } = await import('./helpers/dates.js');

    // Create patient
    const patientResult = await waspOp('create-patient-action', {
      name: 'Test Patient',
      phoneNumber: getPhone(),
      dateOfBirth: getTomorrowDateString(-365 * 30) // 30 years ago
    }, seededAdminSessionId);

    expect(patientResult.status).toBe(200);
    const patient = patientResult.body.json;

    await new Promise(resolve => setTimeout(resolve, 500));

    // Check for Patient CREATE log
    const auditLogsResponse = await waspOp('get-audit-logs-by-user', {
      userId: userId
    }, seededAdminSessionId);

    expect(auditLogsResponse.status).toBe(200);
    const logs = auditLogsResponse.body.json;

    const patientLog = logs.find(log =>
      log.entityType === 'Patient' &&
      log.eventType === 'CREATE' &&
      log.entityId === patient.id
    );

    expect(patientLog).toBeDefined();
    expect(patientLog.actorUserId).toBe(userId);
    expect(patientLog.changedFields?.changes?.name).toBe('Test Patient');
    expect(patientLog.changedFields?.changes?.phoneNumber).toBe(patient.phoneNumber);
  });

  it('should NOT create audit logs for system operations (SMS API)', async () => {
    const { createSms } = await import('./helpers/fixtures.js');

    // Create SMS via external API (system operation, no user)
    await createSms(getPhone(), 'System test');

    await new Promise(resolve => setTimeout(resolve, 500));

    // Get all recent audit logs
    const auditLogsResponse = await waspOp('get-recent-audit-logs', {}, seededAdminSessionId);
    expect(auditLogsResponse.status).toBe(200);
    const logs = auditLogsResponse.body.json;

    // Should NOT have ConsultationRequest CREATE log (system created it)
    const systemRequestLog = logs.find(log =>
      log.entityType === 'ConsultationRequest' &&
      log.eventType === 'CREATE' &&
      log.actorUserId === null // System operations have no actor
    );

    // System operations should not create audit logs
    expect(systemRequestLog).toBeUndefined();
  });

  it('should create audit log when user updates their profile', async () => {
    // Update user's own name
    const updateResult = await waspOp('update-user-profile', {
      name: 'Updated Name'
    }, seededAdminSessionId);

    expect(updateResult.status).toBe(200);

    await new Promise(resolve => setTimeout(resolve, 500));

    const auditLogsResponse = await waspOp('get-audit-logs-by-user', {
      userId: userId
    }, seededAdminSessionId);

    expect(auditLogsResponse.status).toBe(200);
    const logs = auditLogsResponse.body.json;

    const profileUpdateLog = logs.find(log =>
      log.entityType === 'User' &&
      log.eventType === 'UPDATE' &&
      log.entityId === userId
    );

    expect(profileUpdateLog).toBeDefined();
    expect(profileUpdateLog.actorUserId).toBe(userId);
    expect(profileUpdateLog.changedFields?.changes?.name).toBe('Updated Name');
  });

  it('should create audit logs for consultation call with outcome data', async () => {
    const { createSms, getTomorrowDate, createSlots } = await import('./helpers/fixtures.js');

    // Setup: Create consultation
    await createSlots(seededAdminSessionId, userId, getTomorrowDate());
    const phoneNumber = getPhone();
    await createSms(phoneNumber, 'Test symptoms');
    await new Promise(resolve => setTimeout(resolve, 500));

    const requestsResponse = await waspOp('get-consultation-requests', {}, seededAdminSessionId);
    const ourRequest = requestsResponse.body.json.find(r => r.phoneNumber === phoneNumber);
    expect(ourRequest).toBeDefined();

    // Get template from config
    const configResponse2 = await waspOp('get-config', {}, seededAdminSessionId);
    const templateBody2 = configResponse2.body.json.consultationSmsTemplates[0].body;

    const acceptResult = await waspOp('accept-consultation-request', {
      consultationRequestId: ourRequest.id,
      templateBody: templateBody2,
      assignToOnlyMe: false
    }, seededAdminSessionId);
    expect(acceptResult.status).toBe(200);
    const consultation = acceptResult.body.json;

    // Create patient first
    const patientResult = await waspOp('create-patient-action', {
      name: 'Test Patient',
      dateOfBirth: '1990-01-01',
      phoneNumber: phoneNumber
    }, seededAdminSessionId);
    expect(patientResult.status).toBe(200);
    const patient = patientResult.body.json;

    // Assign patient to consultation
    await waspOp('assign-patient-to-consultation', {
      consultationId: consultation.id,
      selectedPatientId: patient.id,
      dateOfBirth: '1990-01-01'
    }, seededAdminSessionId);

    // Create call with outcome data (single action)
    const callResult = await waspOp('create-consultation-call', {
      consultationId: consultation.id,
      status: 'patient_answered',
      patientId: patient.id,
      confirmations: ['Patient answered the phone'],
      chiefComplaint: 'Patient doing well',
      diagnosis: 'Improving',
    }, seededAdminSessionId);
    expect(callResult.status).toBe(200);
    const call = callResult.body.json;

    await new Promise(resolve => setTimeout(resolve, 500));

    const auditLogsResponse = await waspOp('get-audit-logs-by-user', {
      userId: userId
    }, seededAdminSessionId);

    const logs = auditLogsResponse.body.json;

    // Check for ConsultationCall CREATE (with outcome data merged in)
    const callLog = logs.find(log =>
      log.entityType === 'ConsultationCall' &&
      log.eventType === 'CREATE' &&
      log.entityId === call.id
    );
    expect(callLog).toBeDefined();
    expect(callLog.actorUserId).toBe(userId);
    expect(callLog.changedFields?.changes?.consultationId).toBe(consultation.id);
    expect(callLog.changedFields?.changes?.status).toBe('patient_answered');
    expect(callLog.changedFields?.changes?.chiefComplaint).toBe('Patient doing well');

    // Check for Consultation UPDATE (when patientId is set on consultation)
    const consultationUpdateLog = logs.find(log =>
      log.entityType === 'Consultation' &&
      log.eventType === 'UPDATE' &&
      log.entityId === consultation.id
    );
    expect(consultationUpdateLog).toBeDefined();
    expect(consultationUpdateLog.actorUserId).toBe(userId);
    expect(consultationUpdateLog.changedFields?.changes?.patientId).toBe(patient.id);
  });

  it('should create audit log when user sends SMS via UI', async () => {
    // User manually sends SMS
    const smsResult = await waspOp('send-sms-message', {
      phoneNumber: getPhone(),
      body: 'Manual SMS from UI'
    }, seededAdminSessionId);

    expect(smsResult.status).toBe(200);
    const outgoingMsg = smsResult.body.json;

    await new Promise(resolve => setTimeout(resolve, 500));

    const auditLogsResponse = await waspOp('get-audit-logs-by-user', {
      userId: userId
    }, seededAdminSessionId);

    const logs = auditLogsResponse.body.json;

    const smsLog = logs.find(log =>
      log.entityType === 'OutgoingSmsMessage' &&
      log.eventType === 'CREATE' &&
      log.entityId === outgoingMsg.id
    );

    expect(smsLog).toBeDefined();
    expect(smsLog.actorUserId).toBe(userId);
    expect(smsLog.changedFields?.changes?.body).toBe('Manual SMS from UI');
    expect(smsLog.changedFields?.changes?.phoneNumber).toBe(outgoingMsg.phoneNumber);
  });

  it('should create audit log when rejecting consultation request', async () => {
    const { createSms } = await import('./helpers/fixtures.js');

    // Create consultation request
    await createSms(getPhone(), 'Test symptoms');
    await new Promise(resolve => setTimeout(resolve, 500));

    const requestsResponse = await waspOp('get-consultation-requests', {}, seededAdminSessionId);
    const latestRequest = requestsResponse.body.json[requestsResponse.body.json.length - 1];

    // Reject it
    const rejectResult = await waspOp('reject-consultation-request', {
      consultationRequestId: latestRequest.id
    }, seededAdminSessionId);

    expect(rejectResult.status).toBe(200);

    await new Promise(resolve => setTimeout(resolve, 500));

    const auditLogsResponse = await waspOp('get-audit-logs-by-user', {
      userId: userId
    }, seededAdminSessionId);

    const logs = auditLogsResponse.body.json;

    const rejectLog = logs.find(log =>
      log.entityType === 'ConsultationRequest' &&
      log.eventType === 'UPDATE' &&
      log.entityId === latestRequest.id
    );

    expect(rejectLog).toBeDefined();
    expect(rejectLog.actorUserId).toBe(userId);
    expect(rejectLog.changedFields?.changes?.status).toBe('rejected');
  });
});
