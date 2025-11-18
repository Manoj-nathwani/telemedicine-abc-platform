import type { DbSeedFn } from 'wasp/server'
import { PrismaClient } from '@prisma/client'
import { now } from './utils/dateTime'
import { hashPassword } from 'wasp/auth/password'
import { SYSTEM_USERS, ADMIN } from './constants'
import { fakerFR as faker } from '@faker-js/faker'

export const seedConfig: DbSeedFn = async (_extendedPrisma) => {
  // Use raw PrismaClient to bypass audit enforcement during seeding
  const prisma = new PrismaClient()

  try {
    await seedDefaultConfig(prisma)
    await seedSystemUsers(prisma)
    await seedDefaultUsers(prisma)

    // Final sequence reset after all seeded users are created
    await prisma.$executeRaw`
      SELECT setval(pg_get_serial_sequence('"User"', 'id'), (SELECT COALESCE(MAX(id), 0) FROM "User"))
    `
  } finally {
    await prisma.$disconnect()
  }
}

async function seedDefaultConfig(prisma: any) {
  const existingConfig = await prisma.config.findFirst()

  if (!existingConfig) {
    await prisma.config.create({
      data: {
        consultationDurationMinutes: 10,
        breakDurationMinutes: 5,
        bufferTimeMinutes: 5,
        consultationSmsTemplates: [
          { name: 'English', body: 'Your consultation is scheduled for {consultationTime}.' },
          { name: 'Français', body: 'Votre consultation est prevue pour {consultationTime}.' },
          { name: 'Kiswahili', body: 'Ushauri wako umepangwa kwa {consultationTime}.' },
          { name: 'Lingala', body: 'Consultation na yo epangami mpo na {consultationTime}.' },
          { name: 'Kikongo', body: 'Nkanda ya nganga ya mikanda ekozala na {consultationTime}.' },
          { name: 'Tshiluba', body: 'Tshipanganyi tsha nganga tshikaba pa {consultationTime}.' }
        ]
      }
    })
    console.log('✅ Created default Config')
  } else {
    console.log('Config already exists, skipping seed')
  }
}

async function seedSystemUsers(prisma: any) {
  // NOTE: System users use hardcoded IDs for idempotent seeding
  // Seeds use raw PrismaClient, bypassing audit enforcement

  // Create all system users (users without auth)
  for (const user of SYSTEM_USERS) {
    const existing = await prisma.user.findUnique({
      where: { id: user.id }
    })

    if (!existing) {
      await prisma.user.create({ data: user })
      console.log(`✅ Created ${user.name} user`)
    } else {
      console.log(`${user.name} user already exists, skipping seed`)
    }
  }
}

async function seedDefaultUsers(prisma: any) {
  // Create admin from ADMIN_EMAIL environment variable
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) {
    throw new Error('ADMIN_EMAIL environment variable is required')
  }

  const existingAdmin = await prisma.user.findUnique({
    where: { id: ADMIN.id }
  })

  if (!existingAdmin) {
    const hashedPassword = await hashPassword(adminEmail)

    await prisma.user.create({
      data: {
        ...ADMIN,
        auth: {
          create: {
            identities: {
              create: {
                providerName: 'email',
                providerUserId: adminEmail.toLowerCase(),
                providerData: JSON.stringify({
                  hashedPassword,
                  isEmailVerified: true,
                  emailVerificationSentAt: now(),
                  passwordResetSentAt: null,
                }),
              },
            },
          },
        },
      },
    })
    console.log('✅ Created admin from ADMIN_EMAIL')
  } else {
    console.log('Admin already exists, skipping user seed')
  }
}


const COMMON_SYMPTOMS = [
  'fever for 2 days with worsening stomach pains',
  'dry cough for a week and difficulty breathing at night',
  'severe joint pain and headaches for 3 days',
  'dizziness and vomiting since yesterday morning',
  'chest pain and shortness of breath for past 2 days',
  'severe back pain and cannot move properly since 3 days',
  'high fever and body aches since yesterday',
  'severe abdominal pain and nausea for 4 days',
  'persistent headache and neck pain for a week',
  'severe sore throat and difficulty swallowing for 3 days',
  'skin rash and itching all over body since 2 days',
  'ear pain and hearing difficulty since yesterday',
  'severe tooth pain and swollen face for 4 days',
  'blurred vision and severe headache since morning',
  'difficulty walking due to knee pain for past week',
  'severe stomach cramps and diarrhea since 2 days',
  'continuous coughing with blood since yesterday',
  'severe menstrual pain and bleeding for 5 days',
  'difficulty breathing and chest tightness since morning',
  'severe lower back pain and numbness in legs for 3 days',
  'fever with chills and body weakness since yesterday',
  'severe joint pain and swelling for past week'
]

// Generate a random fake consultation request
export function generateFakeConsultationRequest() {
  const firstName = faker.person.firstName()
  const lastName = faker.person.lastName()
  const phoneNumber = faker.phone.number()
  const dob = faker.date.birthdate({ min: 18, max: 70, mode: 'age' })
  const dobFormatted = dob.toLocaleDateString('en-GB') // DD/MM/YYYY format
  const location = faker.location.city()
  const symptom = faker.helpers.arrayElement(COMMON_SYMPTOMS)

  return {
    phoneNumber,
    content: `Hi, I am ${firstName} ${lastName} from ${location}, born ${dobFormatted}. I have ${symptom}.`,
  }
}