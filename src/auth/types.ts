export enum UserRole {
  admin = 'admin',
  clinician = 'clinician'
}

// Human-readable labels for user roles
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  clinician: 'Clinician',
};

export const getUserRoleLabel = (role: UserRole): string => {
  return USER_ROLE_LABELS[role] || role;
}; 