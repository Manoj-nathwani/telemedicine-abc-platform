/**
 * Test data generators (fixtures) for integration tests
 */
import request from 'supertest';
import { getCurrentISOString } from './dates.js';

const BASE_URL = 'http://localhost:3001';

/**
 * Symptom descriptions for realistic test data
 */
const SYMPTOMS = [
  'I have had a fever for 2 days and headaches',
  'My child is coughing a lot and having trouble breathing',
  'I have abdominal pain and vomiting',
  'I need medical help for back pain',
  'My daughter has a high fever',
  'Severe chest pain and difficulty breathing',
  'Persistent headache and dizziness',
  'Skin rash and itching all over body',
];

/**
 * Create SMS message fixtures
 * @param {number} count - Number of messages to create
 * @param {number} startIndex - Starting index for phone numbers (for uniqueness)
 * @returns {Array} Array of SMS message objects
 */
export function createSmsMessages(count, startIndex = 0) {
  const messages = [];
  for (let i = 0; i < count; i++) {
    const phoneIndex = startIndex + i;
    // DRC phone number format: +243 99 XXX XXXX (12 digits total)
    // Pad the last 4 digits to ensure valid phone number
    const lastFourDigits = String(phoneIndex).padStart(4, '0').slice(-4);
    const phoneNumber = `+243991234${lastFourDigits}`;
    const symptom = SYMPTOMS[i % SYMPTOMS.length];

    messages.push({
      sender: phoneNumber,
      text: symptom,
      createdAt: getCurrentISOString(),
    });
  }
  return messages;
}

/**
 * Send SMS messages via SMS API
 * @param {Array} messages - Array of SMS message objects
 * @param {string} apiKey - SMS API key
 * @returns {Promise} Response from API
 */
export async function sendSmsMessages(messages, apiKey) {
  return await request(BASE_URL)
    .post('/api/sms/messages')
    .set('X-API-Key', apiKey)
    .send(messages);
}

/**
 * Create a single SMS message via SMS API (convenience wrapper)
 * @param {string} phoneNumber - Phone number
 * @param {string} text - Message text
 * @returns {Promise} Response from API
 */
export async function createSms(phoneNumber, text) {
  const messages = [{
    sender: phoneNumber,
    text: text,
    createdAt: getCurrentISOString(),
  }];
  return await sendSmsMessages(messages, process.env.SMS_API_KEY);
}

/**
 * Get tomorrow's date string (YYYY-MM-DD)
 */
export function getTomorrowDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

/**
 * Create slots for a user via Wasp operation
 * @param {string} sessionId - User session ID
 * @param {number} userId - User ID (clinician)
 * @param {string} date - Date string (YYYY-MM-DD)
 * @returns {Promise} Response from create-slots operation
 */
export async function createSlots(sessionId, userId, date) {
  const { waspOp } = await import('./wasp.js');
  return await waspOp('bulk-update-slots', {
    date,
    slots: SLOT_PRESETS.twoSlots
  }, sessionId);
}

/**
 * Create availability slot fixtures
 * @param {Array<{startTime: string, endTime: string}>} timeSlots - Array of time slot objects
 * @returns {Array} Array of slot objects with startTime and endTime
 *
 * @example
 * createSlotFixtures([
 *   { startTime: '09:00', endTime: '09:30' },
 *   { startTime: '10:00', endTime: '10:30' }
 * ])
 */
export function createSlotFixtures(timeSlots) {
  return timeSlots.map(({ startTime, endTime }) => ({
    startTime,
    endTime,
  }));
}

/**
 * Common time slot presets
 */
export const SLOT_PRESETS = {
  morning: [
    { startTime: '09:00', endTime: '09:30' },
    { startTime: '10:00', endTime: '10:30' },
    { startTime: '11:00', endTime: '11:30' },
  ],
  afternoon: [
    { startTime: '14:00', endTime: '14:30' },
    { startTime: '15:00', endTime: '15:30' },
    { startTime: '16:00', endTime: '16:30' },
  ],
  twoSlots: [
    { startTime: '14:00', endTime: '14:30' },
    { startTime: '15:00', endTime: '15:30' },
  ],
};

/**
 * Generate near-term slot times (now + offset minutes)
 * This ensures slots are always earlier than old test data from previous runs
 *
 * @param {number} startOffsetMinutes - Minutes from now for first slot (default: 10)
 * @param {number} count - Number of slots to generate (default: 3)
 * @param {number} durationMinutes - Duration of each slot (default: 30)
 * @returns {Array<{startTime: string, endTime: string}>} Array of slot times
 */
export function generateNearTermSlots(startOffsetMinutes = 10, count = 3, durationMinutes = 30) {
  const now = new Date();
  const slots = [];

  for (let i = 0; i < count; i++) {
    const startMinutes = startOffsetMinutes + (i * durationMinutes);
    const endMinutes = startMinutes + durationMinutes;

    const startTime = new Date(now.getTime() + startMinutes * 60000);
    const endTime = new Date(now.getTime() + endMinutes * 60000);

    // Format as HH:mm
    const formatTime = (date) => {
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    };

    slots.push({
      startTime: formatTime(startTime),
      endTime: formatTime(endTime),
    });
  }

  return slots;
}

/**
 * Get today's date string (YYYY-MM-DD)
 * Used with generateNearTermSlots for same-day appointments
 */
export function getTodayDateString() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Generate unique test email
 * @param {string} prefix - Email prefix (default: 'test')
 * @param {string} domain - Email domain (default: 'example.com')
 * @returns {string} Unique email address with timestamp
 */
export function generateTestEmail(prefix = 'test', domain = 'example.com') {
  const timestamp = Date.now();
  return `${prefix}${timestamp}@${domain}`;
}

/**
 * Patient names for realistic test data
 */
const PATIENT_NAMES = [
  'Jean-Pierre Mukendi',
  'Marie Kabila',
  'Joseph Tshisekedi',
  'Grace Mwamba',
  'Emmanuel Kalala',
  'Rose Ngoma',
  'David Kasongo',
  'Sarah Mutombo',
];

/**
 * Generate realistic patient data
 * @param {number} index - Index for selecting patient name (default: random)
 * @returns {object} Patient data object with name and dateOfBirth
 */
export function createPatientData(index = null) {
  const nameIndex = index !== null ? index % PATIENT_NAMES.length : Math.floor(Math.random() * PATIENT_NAMES.length);
  const patientName = PATIENT_NAMES[nameIndex];

  // Generate random DOB between 1950 and 2020
  const year = 1950 + Math.floor(Math.random() * 70);
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
  const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
  const patientDateOfBirth = `${year}-${month}-${day}`;

  return {
    patientName,
    patientDateOfBirth,
  };
}


/**
 * Phone number validation patterns
 */
export const PHONE_PATTERNS = {
  valid: '+243991234',
  invalidShort: '+2439912',
  invalidCountry: '+1234567890',
  malformed: '243-99-123-4567',
};

/**
 * Generate test phone number
 * @param {number} index - Unique identifier (0-9999)
 * @param {string} pattern - Base pattern (default: PHONE_PATTERNS.valid)
 * @returns {string} Phone number
 */
export function generatePhoneNumber(index, pattern = PHONE_PATTERNS.valid) {
  const lastFourDigits = String(index).padStart(4, '0').slice(-4);
  return `${pattern}${lastFourDigits}`;
}

/**
 * Get outgoing SMS messages via SMS API
 * @param {string} apiKey - SMS API key
 * @returns {Promise} Response from API
 */
export async function getOutgoingSmsMessages(apiKey) {
  return await request(BASE_URL)
    .get('/api/sms/outgoing-messages')
    .set('X-API-Key', apiKey);
}

/**
 * Mark outgoing SMS message as sent/failed via SMS API
 * @param {number} id - Outgoing message ID
 * @param {boolean} success - Whether the message was sent successfully
 * @param {string} apiKey - SMS API key
 * @returns {Promise} Response from API
 */
export async function markSmsAsSent(id, success, apiKey) {
  return await request(BASE_URL)
    .post('/api/sms/outgoing-message')
    .set('X-API-Key', apiKey)
    .send({ id, success });
}
