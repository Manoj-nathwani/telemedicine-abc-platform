// Centralized error codes and descriptions for the app

export type AppErrorCode = 'NO_AVAILABLE_SLOTS' | 'CONSULTATION_REQUEST_ALREADY_ACCEPTED' | 'BOOKING_FAILED';

export interface AppErrorInfo {
  code: AppErrorCode;
  message: string; // Server-side message
  description: string; // Client-side message
}

export const ERROR_CODES: Record<AppErrorCode, AppErrorInfo> = {
  NO_AVAILABLE_SLOTS: {
    code: 'NO_AVAILABLE_SLOTS',
    message: 'No availability',
    description: 'There are currently no slots available with any clinician. Please create some available slots to start accepting consultation requests.'
  },
  CONSULTATION_REQUEST_ALREADY_ACCEPTED: {
    code: 'CONSULTATION_REQUEST_ALREADY_ACCEPTED',
    message: 'Request already accepted',
    description: 'This request has already been accepted by someone else. You should see it in the accepted requests list.'
  },
  BOOKING_FAILED: {
    code: 'BOOKING_FAILED',
    message: 'Booking failed',
    description: 'An unexpected error occurred while accepting the consultation request.'
  }
}; 