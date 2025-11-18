/**
 * Wasp-specific utilities for integration tests
 */
import request from 'supertest';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

const BASE_URL = 'http://localhost:3001';

/**
 * Make authenticated Wasp operation call
 */
export async function waspOp(operation, args = {}, sessionId) {
  return await request(BASE_URL)
    .post(`/operations/${operation}`)
    .set('Authorization', `Bearer ${sessionId}`)
    .send({ json: args, meta: { values: {} } });
}

/**
 * Login user and return session ID
 */
export async function loginUser(email, password) {
  const response = await request(BASE_URL)
    .post('/auth/email/login')
    .send({ email, password });

  if (response.status !== 200) {
    throw new Error(`Login failed: ${response.status}`);
  }
  return response.body.sessionId;
}

/**
 * Generate JWT reset token and reset password
 */
export async function setUserPassword(email, password) {
  const jwtSecret = process.env.JWT_SECRET;
  const resetToken = jwt.sign({ email }, jwtSecret, { expiresIn: '1h' });

  const response = await request(BASE_URL)
    .post('/auth/email/reset-password')
    .send({ token: resetToken, password });

  if (response.status !== 200) {
    throw new Error(`Password reset failed: ${response.status}`);
  }
}

/**
 * Check if server is running and load environment
 */
export async function setupTests() {
  dotenv.config({ path: '.env.server' });
  try {
    await request(BASE_URL).get('/');
  } catch (error) {
    throw new Error('Server not running on http://localhost:3001. Please start it with: wasp start');
  }
}

/**
 * Re-export cleanup from single source of truth
 */
export { cleanupTestData } from '../globalSetup.js';
