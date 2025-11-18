import { HttpError } from 'wasp/server';

/**
 * Validates that the user is authenticated and returns the user
 * Throws HttpError(401) if not authenticated
 */
export const throwIfNotAuthenticated = (context: any) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  return context.user;
};

/**
 * Validates that the user is an admin
 * Throws HttpError(403) if not authorized
 */
export const throwIfNotAdmin = (user: any) => {
  if (!user) {
    throw new HttpError(401, 'Not authenticated');
  }
  if (user.role !== 'admin') {
    throw new HttpError(403, 'Insufficient permissions');
  }
};