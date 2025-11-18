/**
 * localStorage Utilities
 * 
 * Helper functions for managing localStorage with type safety and defaults
 */

export type AssignmentPreference = 'assign-to-me-only' | 'assign-to-any-clinician';

const ASSIGNMENT_PREFERENCE_KEY = 'triage-assignment-preference';
const DEFAULT_ASSIGNMENT_PREFERENCE: AssignmentPreference = 'assign-to-any-clinician';

/**
 * Get the assignment preference from localStorage
 * @returns The saved preference or the default if not found/invalid
 */
export function getAssignmentPreference(): AssignmentPreference {
  if (typeof window === 'undefined') {
    return DEFAULT_ASSIGNMENT_PREFERENCE;
  }

  try {
    const saved = localStorage.getItem(ASSIGNMENT_PREFERENCE_KEY);
    // Support migration from old values for backwards compatibility
    if (saved === 'me') {
      return 'assign-to-me-only';
    }
    if (saved === 'next-available') {
      return 'assign-to-any-clinician';
    }
    return (saved === 'assign-to-me-only' || saved === 'assign-to-any-clinician') 
      ? saved 
      : DEFAULT_ASSIGNMENT_PREFERENCE;
  } catch {
    return DEFAULT_ASSIGNMENT_PREFERENCE;
  }
}

/**
 * Save the assignment preference to localStorage
 * @param preference - The preference to save
 */
export function setAssignmentPreference(preference: AssignmentPreference): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(ASSIGNMENT_PREFERENCE_KEY, preference);
  } catch (error) {
    console.warn('Failed to save assignment preference to localStorage:', error);
  }
}

