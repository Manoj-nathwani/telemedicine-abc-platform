/**
 * UNIFIED TEST CLEANUP STRATEGY
 *
 * This is the SINGLE SOURCE OF TRUTH for test cleanup.
 * All test files use these functions.
 */
import { PrismaClient } from '@prisma/client';
import { seedConfig } from '../../src/seeds.js';
import dotenv from 'dotenv';

/**
 * Clean test data between tests (afterEach)
 * Keeps users and audit events, deletes everything else
 */
export async function cleanupTestData() {
  const prisma = new PrismaClient();
  try {
    // Note: AuditEvent cleanup skipped - it's append-only and doesn't interfere with tests
    await prisma.consultationCall.deleteMany({});
    await prisma.outgoingSmsMessage.deleteMany({});
    await prisma.consultation.deleteMany({});
    await prisma.consultationRequest.deleteMany({});
    await prisma.slot.deleteMany({});
    await prisma.smsMessage.deleteMany({});
    await prisma.patient.deleteMany({});
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Global setup - runs once before all test files
 * Resets entire database and seeds admin
 */
export default async function globalSetup() {
  // Load Wasp's generated env (has DATABASE_URL with correct container name)
  dotenv.config({ path: '.wasp/out/server/.env' });

  const prisma = new PrismaClient();

  try {

    // Delete audit events first (or it will block user deletion)
    try {
      await prisma.auditEvent.deleteMany({});
    } catch (e: any) {
      // AuditEvent table doesn't exist yet (pre-migration), skip
      if (!e.message?.includes('does not exist')) {
        throw e;
      }
    }

    await prisma.consultationCall.deleteMany({});
    await prisma.outgoingSmsMessage.deleteMany({});
    await prisma.consultation.deleteMany({});
    await prisma.consultationRequest.deleteMany({});
    await prisma.slot.deleteMany({});
    await prisma.smsMessage.deleteMany({});
    await prisma.patient.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.authIdentity.deleteMany({});
    await prisma.auth.deleteMany({});

    // Create system users with hardcoded IDs (using raw SQL to bypass audit enforcement)
    await prisma.$executeRaw`
      INSERT INTO "User" (id, name, role, "createdAt")
      VALUES (1, 'System', 'system', NOW())
      ON CONFLICT (id) DO NOTHING
    `;
    await prisma.$executeRaw`
      INSERT INTO "User" (id, name, role, "createdAt")
      VALUES (2, 'SmsService', 'system', NOW())
      ON CONFLICT (id) DO NOTHING
    `;

    // Create admin via raw SQL (tests use raw Prisma, can't use __auditUserId)
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      throw new Error('ADMIN_EMAIL environment variable is required');
    }

    const { hashPassword } = await import('wasp/auth/password');
    const hashedPassword = await hashPassword(adminEmail);

    // Check if admin already exists
    const existingAuth = await prisma.auth.findFirst({
      include: { identities: true },
      where: {
        identities: {
          some: {
            providerName: 'email',
            providerUserId: adminEmail.toLowerCase(),
          },
        },
      },
    });

    if (!existingAuth) {
      // Create user, auth, and identity records via raw SQL
      await prisma.$executeRaw`
        WITH new_user AS (
          INSERT INTO "User" (name, role, "createdAt")
          VALUES ('Administrator', 'admin', NOW())
          RETURNING id
        ),
        new_auth AS (
          INSERT INTO "Auth" (id, "userId")
          SELECT gen_random_uuid(), id FROM new_user
          RETURNING id
        )
        INSERT INTO "AuthIdentity" ("providerName", "providerUserId", "providerData", "authId")
        SELECT
          'email',
          ${adminEmail.toLowerCase()},
          ${JSON.stringify({
            hashedPassword,
            isEmailVerified: true,
            emailVerificationSentAt: new Date().toISOString(),
            passwordResetSentAt: null,
          })},
          id
        FROM new_auth
      `;
    }

  } catch (error) {
    console.error('Failed to setup database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
