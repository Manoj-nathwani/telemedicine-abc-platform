export interface RouteConfig {
  path: string;
  labelKey: string;
  requiresAuth?: boolean;
  isAuthPage?: boolean;
  requiresAdmin?: boolean;
}

// Define route keys as a const object for type safety
const ROUTE_KEYS = {
  login: 'login',
  emailVerification: 'emailVerification',
  requestPasswordReset: 'requestPasswordReset',
  passwordReset: 'passwordReset',
  dashboard: 'dashboard',
  triage: 'triage',
  consultations: 'consultations',
  consultation: 'consultation',
  patients: 'patients',
  userManagement: 'userManagement',
  availability: 'availability',
  smsMessages: 'smsMessages',
  config: 'config',
  auditLogs: 'auditLogs',
  profile: 'profile'
} as const;

type RouteKey = keyof typeof ROUTE_KEYS;

// All application routes with metadata
export const ROUTES: { [K in RouteKey]: RouteConfig } = {
  // Auth routes
  login: {
    path: '/login',
    labelKey: 'routes.login',
    isAuthPage: true
  },
  emailVerification: {
    path: '/email-verification',
    labelKey: 'routes.emailVerification',
    isAuthPage: true
  },
  requestPasswordReset: {
    path: '/request-password-reset',
    labelKey: 'routes.requestPasswordReset',
    isAuthPage: true
  },
  passwordReset: {
    path: '/password-reset',
    labelKey: 'routes.passwordReset',
    isAuthPage: true
  },
  
  // Dashboard
  dashboard: {
    path: '/dashboard',
    labelKey: 'routes.dashboard',
    requiresAuth: true
  },
  
  // Consultation routes
  triage: {
    path: '/triage',
    labelKey: 'routes.triage',
    requiresAuth: true
  },
  consultations: {
    path: '/consultations',
    labelKey: 'routes.consultations',
    requiresAuth: true
  },
  consultation: {
    path: '/consultations/:id',
    labelKey: 'routes.consultation',
    requiresAuth: true
  },
  patients: {
    path: '/patients',
    labelKey: 'routes.patients',
    requiresAuth: true
  },

  // Admin routes
  userManagement: {
    path: '/admin/users',
    labelKey: 'routes.userManagement',
    requiresAuth: true
  },
  availability: {
    path: '/availability',
    labelKey: 'routes.availability',
    requiresAuth: true
  },
  smsMessages: {
    path: '/admin/sms-messages',
    labelKey: 'routes.smsMessages',
    requiresAuth: true,
    requiresAdmin: true
  },
  config: {
    path: '/admin/config',
    labelKey: 'routes.config',
    requiresAuth: true,
    requiresAdmin: true
  },
  auditLogs: {
    path: '/admin/audit-logs',
    labelKey: 'routes.auditLogs',
    requiresAuth: true,
    requiresAdmin: true
  },
  profile: {
    path: '/profile',
    labelKey: 'routes.profile',
    requiresAuth: true
  }
};

// Helper functions

export const getAuthRoutes = (): RouteConfig[] => {
  return Object.values(ROUTES).filter(route => route.isAuthPage);
};

export const getAuthenticatedRoutes = (): RouteConfig[] => {
  return Object.values(ROUTES).filter(route => route.requiresAuth);
};

export const getConsultationUrl = (id: number | string) => {
  const consultationRoute = ROUTES.consultation;
  if (!consultationRoute) {
    throw new Error('Consultation route not found');
  }
  return consultationRoute.path.replace(':id', String(id));
};