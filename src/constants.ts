export const BRAND_NAME = 'Allô Munganga';
export const SMS_PAGINATION_SIZE = 100;

// Clinician/Provider UI languages (for web dashboard)
export const CLINICIAN_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' }
] as const;

export const TIMEZONE = 'Africa/Kinshasa' as const;

// Special users (hardcoded for idempotent seeding)
export const SYSTEM_USER = {
  id: 1,
  name: 'System',
  role: 'system' as const
} as const;

export const SMS_SERVICE_USER = {
  id: 2,
  name: 'SMS Service',
  role: 'system' as const
} as const;

export const ADMIN = {
  id: 3,
  name: 'Admin',
  role: 'admin' as const
} as const;

// Array of system users to seed (users without auth)
export const SYSTEM_USERS = [
  SYSTEM_USER,
  SMS_SERVICE_USER
] as const;
