/**
 * Workflow helper functions for integration tests
 *
 * These helpers encapsulate common multi-step workflows to reduce duplication.
 * IMPORTANT: Only use Wasp operations (waspOp) - no direct DB/Prisma access.
 */
import { waspOp } from './wasp.js';
import { createSmsMessages, sendSmsMessages, SLOT_PRESETS, createPatientData } from './fixtures.js';

/**
 * Find a consultation request by phone number
 *
 * @param {string} sessionId - User session
 * @param {string} phoneNumber - Phone number to search for
 * @param {string} status - Request status (default: 'pending')
 * @returns {Promise<object|null>} Request object or null if not found
 */
export async function findRequestByPhone(sessionId, phoneNumber, status = 'pending') {
  const response = await waspOp('get-consultation-requests', { status }, sessionId);

  if (response.status !== 200) {
    return null;
  }

  return response.body.json.find((r) => r.phoneNumber === phoneNumber) || null;
}

/**
 * Accept a consultation request (SMS → Request → Accept → Consultation)
 *
 * BUSINESS RULE: Consultation is assigned to whoever owns the next available slot,
 * not necessarily the user accepting the request. This function creates slots
 * for the accepting user to ensure they own the consultation (for predictable tests).
 *
 * @param {string} sessionId - User session (who accepts the request)
 * @param {number} phoneIndex - Phone number index for createSmsMessages
 * @param {string} dateStr - Date string for slots (YYYY-MM-DD)
 * @param {object} options - Optional parameters
 * @returns {Promise<object>} { consultationId, requestId, phoneNumber, userId }
 */
export async function acceptConsultationOnly(sessionId, phoneIndex, dateStr, options = {}) {
  const { slots = SLOT_PRESETS.morning } = options;

  // Step 1: Create SMS message → ConsultationRequest
  const messages = createSmsMessages(1, phoneIndex);
  const phoneNumber = messages[0].sender;

  const smsResponse = await sendSmsMessages(messages, process.env.SMS_API_KEY);
  if (smsResponse.status !== 200) {
    throw new Error(`Failed to send SMS: ${smsResponse.status}`);
  }

  // Step 2: Create availability slots for this user
  // This ensures the consultation will be assigned to them (they own the next available slot)
  const slotsResponse = await waspOp('bulk-update-slots', { date: dateStr, slots }, sessionId);
  if (slotsResponse.status !== 200) {
    throw new Error(`Failed to create slots: ${slotsResponse.status}`);
  }

  // Step 3: Fetch the pending request
  const request = await findRequestByPhone(sessionId, phoneNumber, 'pending');
  if (!request) {
    throw new Error(`Request not found for phone number: ${phoneNumber}`);
  }

  // Step 4: Get template from config (use first template)
  const configResponse = await waspOp('get-config', {}, sessionId);
  if (configResponse.status !== 200) {
    throw new Error(`Failed to get config: ${configResponse.status}`);
  }
  const config = configResponse.body.json;
  const templateBody = config.consultationSmsTemplates && config.consultationSmsTemplates.length > 0
    ? config.consultationSmsTemplates[0].body
    : 'Your consultation is scheduled for {consultationTime}.'; // Fallback

  // Step 5: Accept the request → Creates Consultation
  // Consultation gets assigned to whoever owns the next available slot (this user, since we just created slots)
  const acceptResponse = await waspOp('accept-consultation-request', {
    consultationRequestId: request.id,
    templateBody,
    assignToOnlyMe: false
  }, sessionId);
  if (acceptResponse.status !== 200) {
    throw new Error(`Failed to accept request: ${acceptResponse.status} - ${JSON.stringify(acceptResponse.body)}`);
  }

  // acceptResponse.body.json is basic Consultation: { id, userId, consultationRequestId, slotId, createdAt }
  const consultation = acceptResponse.body.json;

  return {
    consultationId: consultation.id,
    requestId: request.id,
    phoneNumber,
    userId: consultation.userId, // User who owns the consultation (slot owner)
  };
}

/**
 * Create a Patient record
 *
 * @param {string} sessionId - User session
 * @param {string} phoneNumber - Patient phone number
 * @param {number} index - Index for patient data generation (default: 0)
 * @returns {Promise<object>} { patientId, name, dateOfBirth, phoneNumber }
 */
export async function createTestPatient(sessionId, phoneNumber, index = 0) {
  const patientData = createPatientData(index);

  const patientResponse = await waspOp(
    'create-patient-action',
    {
      name: patientData.patientName,
      dateOfBirth: patientData.patientDateOfBirth
    },
    sessionId
  );

  if (patientResponse.status !== 200) {
    throw new Error(`Failed to create patient: ${patientResponse.status}`);
  }

  const patient = patientResponse.body.json;
  return {
    patientId: patient.id,
    name: patient.name,
    dateOfBirth: patient.dateOfBirth,
    phoneNumber: phoneNumber, // Return the phone number passed in for test convenience
  };
}

/**
 * Create a ConsultationCall for an existing consultation
 *
 * @param {string} sessionId - User session
 * @param {number} consultationId - Consultation ID
 * @param {string} status - Call status ('patient_answered' | 'patient_no_answer' | 'clinician_did_not_call')
 * @param {object} options - Optional outcome data for successful calls
 * @returns {Promise<object>} { callId, status }
 */
export async function createTestCall(sessionId, consultationId, status = 'patient_answered', options = {}) {
  const {
    patientId,
    confirmations = ['Patient answered the phone', 'Patient identity confirmed', 'Safe location confirmed'],
    chiefComplaint = 'Fever and headache',
    reviewOfSystems = 'No cough, no chest pain',
    pastMedicalHistory = 'Hypertension',
    diagnosis = 'Viral syndrome',
    labTests = 'None',
    prescriptions = 'Paracetamol 500mg BID',
    safetyNetting = 'Return if fever persists >5 days',
    followUp = 'Phone call in 1 week',
    additionalNotes = '',
  } = options;

  const callResponse = await waspOp(
    'create-consultation-call',
    {
      consultationId,
      status,
      ...(status === 'patient_answered' && {
        patientId,
        confirmations,
        chiefComplaint,
        reviewOfSystems,
        pastMedicalHistory,
        diagnosis,
        labTests,
        prescriptions,
        safetyNetting,
        followUp,
        additionalNotes
      })
    },
    sessionId
  );

  if (callResponse.status !== 200) {
    throw new Error(`Failed to create call: ${callResponse.status}`);
  }

  const call = callResponse.body.json;
  return {
    callId: call.id,
    status: call.status,
  };
}


/**
 * Send a follow-up SMS for a consultation
 *
 * @param {string} sessionId - User session
 * @param {number} consultationId - Consultation ID
 * @param {string} phoneNumber - Patient phone number
 * @param {string} message - SMS message content
 * @returns {Promise<object>} { smsId, phoneNumber, body }
 */
export async function sendTestSms(sessionId, consultationId, phoneNumber, message) {
  const smsResponse = await waspOp(
    'send-consultation-sms',
    {
      consultationId,
      phoneNumber,
      message,
    },
    sessionId
  );

  if (smsResponse.status !== 200) {
    throw new Error(`Failed to send SMS: ${smsResponse.status}`);
  }

  const sms = smsResponse.body.json;
  return {
    smsId: sms.id,
    phoneNumber: sms.phoneNumber,
    body: sms.body,
  };
}

/**
 * Complete consultation workflow: Accept → Patient → Call (with outcome)
 *
 * Covers the full consultation flow from accepting a request to documenting the call.
 * SMS sending is separate and done manually by clinician via the UI.
 *
 * @param {string} sessionId - User session
 * @param {number} phoneIndex - Phone number index
 * @param {string} dateStr - Date string for slots (YYYY-MM-DD)
 * @param {object} options - Optional parameters
 * @returns {Promise<object>} { consultationId, callId, patientId, phoneNumber }
 */
export async function completeConsultationWorkflow(sessionId, phoneIndex, dateStr, options = {}) {
  const {
    callStatus = 'patient_answered',
    patientIndex = 0,
    // Clinical fields for the call
    confirmations,
    chiefComplaint,
    reviewOfSystems,
    pastMedicalHistory,
    diagnosis,
    labTests,
    prescriptions,
    safetyNetting,
    followUp,
    additionalNotes,
  } = options;

  // Step 1: Accept consultation (SMS → Request → Accept → Consultation)
  const { consultationId, phoneNumber } = await acceptConsultationOnly(sessionId, phoneIndex, dateStr, options);

  // Step 2: Create Patient and assign to consultation (if call will be successful)
  let patientId = null;
  if (callStatus === 'patient_answered') {
    const patient = await createTestPatient(sessionId, phoneNumber, patientIndex);
    patientId = patient.patientId;

    // Assign patient to consultation before creating call
    const assignResponse = await waspOp(
      'assign-patient-to-consultation',
      {
        consultationId,
        selectedPatientId: patientId,
        dateOfBirth: patient.dateOfBirth
      },
      sessionId
    );

    if (assignResponse.status !== 200) {
      throw new Error(`Failed to assign patient: ${assignResponse.status}`);
    }
  }

  // Step 3: Create ConsultationCall with outcome data (single action)
  const { callId } = await createTestCall(sessionId, consultationId, callStatus, {
    patientId,
    confirmations,
    chiefComplaint,
    reviewOfSystems,
    pastMedicalHistory,
    diagnosis,
    labTests,
    prescriptions,
    safetyNetting,
    followUp,
    additionalNotes,
  });

  return {
    consultationId,
    callId,
    patientId,
    phoneNumber,
  };
}

/**
 * Create multiple consultation requests without accepting them
 * Useful for testing triage dashboard, filtering, etc.
 *
 * @param {number} count - Number of requests to create
 * @param {number} startPhoneIndex - Starting phone index
 * @returns {Promise<Array>} Array of phone numbers
 */
export async function createMultipleRequests(count, startPhoneIndex) {
  const messages = createSmsMessages(count, startPhoneIndex);
  const smsResponse = await sendSmsMessages(messages, process.env.SMS_API_KEY);

  if (smsResponse.status !== 200) {
    throw new Error(`Failed to send SMS messages: ${smsResponse.status}`);
  }

  return messages.map((m) => m.sender);
}
