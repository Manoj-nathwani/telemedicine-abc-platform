// Import the actual Prisma-generated enum types
import { type ConsultationCallStatus, type Patient } from "@prisma/client";

export type { ConsultationCallStatus };

// Color mapping for consultation call status
export const CONSULTATION_CALL_STATUS_COLORS: Record<ConsultationCallStatus, string> = {
  patient_answered: 'success',
  patient_no_answer: 'secondary',
  clinician_did_not_call: 'secondary',
};

export const getCallStatusColor = (status: ConsultationCallStatus): string => {
  return CONSULTATION_CALL_STATUS_COLORS[status] || '';
};

// Human-readable labels for consultation call status
export const CONSULTATION_CALL_STATUS_LABELS: Record<ConsultationCallStatus, string> = {
  patient_answered: 'Patient Answered Call',
  patient_no_answer: 'Patient Did Not Answer Call',
  clinician_did_not_call: 'Clinician Did Not Call',
};

export const getCallStatusLabel = (status: ConsultationCallStatus): string => {
  return CONSULTATION_CALL_STATUS_LABELS[status] || status;
};

// Action input types
export type UpdateConsultationArgs = {
  consultationId: number;
};

export type CreateConsultationCallInput = {
  consultationId: number;
  status: string; // Will be converted to ConsultationCallStatus enum
  patientId?: number; // Optional: If provided, will update Consultation.patientId
  confirmations?: string[];
  chiefComplaint?: string;
  reviewOfSystems?: string;
  pastMedicalHistory?: string;
  diagnosis?: string;
  labTests?: string;
  prescriptions?: string;
  safetyNetting?: string;
  followUp?: string;
  additionalNotes?: string;
};

export type SendConsultationSmsInput = {
  consultationId: number;
  message: string;
  phoneNumber: string;
};

// Consultation query result types
type ConsultationCallRecord = {
  id: number;
  createdAt: Date;
  status: ConsultationCallStatus;
  conductedBy: {
    id: number;
    name: string;
  };
  confirmations?: string[] | null;
  chiefComplaint?: string | null;
  reviewOfSystems?: string | null;
  pastMedicalHistory?: string | null;
  diagnosis?: string | null;
  labTests?: string | null;
  prescriptions?: string | null;
  safetyNetting?: string | null;
  followUp?: string | null;
  additionalNotes?: string | null;
};

export type ConsultationWithCalls = {
  id: number;
  createdAt: Date;
  assignedToUserId: number;
  consultationRequest: {
    id: number;
    phoneNumber: string;
    description: string;
    createdAt: Date;
    statusActionedBy?: {
      id: number;
      name: string;
    } | null;
    statusActionedAt?: Date | null;
  };
  slot: {
    id: number;
    startDateTime: Date;
    endDateTime: Date;
    userId: number;
    user: {
      id: number;
      name: string;
    };
  };
  patient?: (Patient & {
    consultations: {
      id: number;
      createdAt: Date;
    }[];
  }) | null;
  calls: ConsultationCallRecord[];
  outgoingSmsMessages?: {
    id: number;
    phoneNumber: string;
    body: string;
    success: boolean | null;
    createdAt: Date;
  }[];
};

// Helper function to safely convert string to ConsultationCallStatus enum
export const toConsultationCallStatus = (value: string): ConsultationCallStatus => {
  if (value === 'patient_answered' || value === 'patient_no_answer' || value === 'clinician_did_not_call') {
    return value as ConsultationCallStatus;
  }
  throw new Error(`Invalid consultation call status: ${value}`);
};

// Compute consultation status based on calls
export const getConsultationStatusFromCalls = (calls: ConsultationCallRecord[]): { status: string; color: string } => {
  if (calls.length === 0) {
    return { status: 'No calls yet', color: 'warning-subtle' };
  }
  
  const hasSuccessfulCall = calls.some(call => call.status === 'patient_answered');
  if (hasSuccessfulCall) {
    return { status: 'Completed', color: 'success-subtle' };
  }
  
  const latestCall = calls[calls.length - 1];
  if (!latestCall) {
    return { status: 'No calls yet', color: 'warning-subtle' };
  }
  
  return { 
    status: getCallStatusLabel(latestCall.status), 
    color: getCallStatusColor(latestCall.status) 
  };
};

 