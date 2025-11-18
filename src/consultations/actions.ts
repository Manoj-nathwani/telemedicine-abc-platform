import {
  type Consultation,
  type Slot,
  type ConsultationCall,
  type ConsultationRequest
} from "wasp/entities";
import { HttpError } from "wasp/server";
import {
  type AcceptConsultationRequest,
  type UpdateConsultation,
  type RejectConsultationRequest,
  type DeleteSlot
} from "wasp/server/operations";
import { parse } from '../utils/dateTime';
import { bookConsultation } from "./consultationBooking";
import {
  type UpdateConsultationArgs,
  type CreateConsultationCallInput,
  type SendConsultationSmsInput,
  toConsultationCallStatus
} from './types';
import { throwIfNotAuthenticated, throwIfNotAdmin } from '../utils/auth/server';
import { generateFakeConsultationRequest } from '../seeds';

type CreateConsultationRequestArgs = {
  phoneNumber: string;
  message: string;
};

export const createConsultationRequest = async (
  { phoneNumber, message }: CreateConsultationRequestArgs,
  context: any
): Promise<ConsultationRequest> => {
  throwIfNotAuthenticated(context);

  // In development, if both fields are empty, use random fake data
  if (process.env.NODE_ENV === 'development' && phoneNumber === '' && message === '') {
    const fakeRequest = generateFakeConsultationRequest();
    return context.entities.ConsultationRequest.create({
      data: {
        phoneNumber: fakeRequest.phoneNumber,
        description: fakeRequest.content
      },
      __auditUserId: context.user.id
    });
  }

  return context.entities.ConsultationRequest.create({
    data: {
      phoneNumber,
      description: message
    },
    __auditUserId: context.user.id
  });
};

type AcceptConsultationRequestArgs = {
  consultationRequestId: number;
  templateBody: string;
  assignToOnlyMe: boolean;
};

export const acceptConsultationRequest: AcceptConsultationRequest<AcceptConsultationRequestArgs, Consultation> = async (
  { consultationRequestId, templateBody, assignToOnlyMe }: AcceptConsultationRequestArgs,
  context: any
) => {
  throwIfNotAuthenticated(context);

  return await bookConsultation(context, consultationRequestId, templateBody, assignToOnlyMe);
};

export const updateConsultation: UpdateConsultation<UpdateConsultationArgs, Consultation> = async (
  { consultationId }: UpdateConsultationArgs,
  context: any
) => {
  throwIfNotAuthenticated(context);

  // Validate consultationId is provided
  if (!consultationId) {
    throw new HttpError(400, 'Consultation ID is required');
  }

  // Team-based care: Any clinician can access any consultation
  const consultation = await context.entities.Consultation
    .findFirst({ where: { id: consultationId } });

  if (!consultation) {
    throw new HttpError(404, 'Consultation not found');
  }

  return consultation;
};

type RejectConsultationRequestArgs = {
  consultationRequestId: number;
};

export const rejectConsultationRequest: RejectConsultationRequest<RejectConsultationRequestArgs, any> = async (
  { consultationRequestId }: RejectConsultationRequestArgs,
  context: any
) => {
  throwIfNotAuthenticated(context);

  return context.entities.ConsultationRequest.update({
    where: { id: consultationRequestId },
    data: { 
      status: "rejected",
      statusActionedByUserId: context.user.id
    },
    __auditUserId: context.user.id
  });
};

type DeleteSlotArgs = {
  slotId: number;
};

export const deleteSlot: DeleteSlot<DeleteSlotArgs, Slot> = async (
  { slotId }: DeleteSlotArgs,
  context: any
) => {
  throwIfNotAuthenticated(context);

  // Find the slot (without userId restriction)
  const slot = await context.entities.Slot.findUnique({
    where: { id: slotId },
    include: {
      consultation: true,
      user: true
    }
  });

  if (!slot) {
    throw new HttpError(404, 'Slot not found');
  }

  // If deleting another user's slot, require admin permissions
  if (slot.userId !== context.user.id) {
    throwIfNotAdmin(context.user);
  }

  // Check if the slot has a consultation (shouldn't be deleted if booked)
  if (slot.consultation) {
    throw new HttpError(400, 'Cannot delete a slot that has a consultation');
  }

  return context.entities.Slot.delete({
    where: { id: slotId }
  });
};

// Create patient action
export const createPatient = async (
  { name, dateOfBirth }: { name: string; dateOfBirth: string },
  context: any
) => {
  throwIfNotAuthenticated(context);

  return context.entities.Patient.create({
    data: {
      name,
      dateOfBirth: parse(dateOfBirth)
    },
    __auditUserId: context.user.id
  });
};

// CONSULTATION CALL ACTIONS

export const createConsultationCall = async (
  {
    consultationId,
    status,
    patientId,
    confirmations,
    chiefComplaint,
    reviewOfSystems,
    pastMedicalHistory,
    diagnosis,
    labTests,
    prescriptions,
    safetyNetting,
    followUp,
    additionalNotes
  }: CreateConsultationCallInput,
  context: any
): Promise<ConsultationCall> => {
  throwIfNotAuthenticated(context);

  // Team-based care: Any clinician can create calls for any consultation
  const consultation = await context.entities.Consultation.findFirst({
    where: { id: consultationId },
    select: { id: true, patientId: true }
  });

  if (!consultation) {
    throw new HttpError(404, 'Consultation not found');
  }

  // Validate outcome fields only provided for successful calls
  const callStatus = toConsultationCallStatus(status);

  // Validate consultation has patient assigned (only required for patient_answered)
  if (callStatus === 'patient_answered' && !consultation.patientId) {
    throw new HttpError(400, 'Consultation must have a patient assigned for patient_answered calls');
  }
  const hasOutcomeFields = confirmations || chiefComplaint || reviewOfSystems ||
    pastMedicalHistory || diagnosis || labTests || prescriptions ||
    safetyNetting || followUp;

  if (callStatus !== 'patient_answered' && hasOutcomeFields) {
    throw new HttpError(400, 'Outcome fields can only be provided for patient_answered calls');
  }

  // Create the call with outcome data
  return context.entities.ConsultationCall.create({
    data: {
      consultationId,
      conductedByUserId: context.user.id,
      status: callStatus,
      confirmations,
      chiefComplaint,
      reviewOfSystems,
      pastMedicalHistory,
      diagnosis,
      labTests,
      prescriptions,
      safetyNetting,
      followUp,
      additionalNotes
    },
    __auditUserId: context.user.id
  });
};

export const sendConsultationSms = async (
  { consultationId, message, phoneNumber }: SendConsultationSmsInput,
  context: any
) => {
  throwIfNotAuthenticated(context);

  // Team-based care: Any clinician can send SMS for any consultation
  const consultation = await context.entities.Consultation
    .findFirst({ where: { id: consultationId } });

  if (!consultation) {
    throw new HttpError(404, 'Consultation not found');
  }

  // Create outgoing SMS
  return context.entities.OutgoingSmsMessage.create({
    data: {
      consultationId,
      phoneNumber,
      body: message,
      success: null, // pending
      sentByUserId: context.user.id,
    },
    __auditUserId: context.user.id
  });
};

type AssignPatientToConsultationArgs = {
  consultationId: number;
  selectedPatientId?: number | null;
  newPatientName?: string | null;
  dateOfBirth: string;
};

export const assignPatientToConsultation = async (
  { consultationId, selectedPatientId, newPatientName, dateOfBirth }: AssignPatientToConsultationArgs,
  context: any
) => {
  throwIfNotAuthenticated(context);

  // Team-based care: Any clinician can assign patients to any consultation
  const consultation = await context.entities.Consultation.findFirst({
    where: { id: consultationId }
  });

  if (!consultation) {
    throw new HttpError(404, 'Consultation not found');
  }

  let patientId = selectedPatientId;

  // Create new patient if name is provided
  if (newPatientName && !selectedPatientId) {
    const newPatient = await createPatient(
      { name: newPatientName, dateOfBirth },
      context
    );
    patientId = newPatient.id;
  }

  if (!patientId) {
    throw new HttpError(400, 'Either selectedPatientId or newPatientName must be provided');
  }

  // Update consultation with patient
  return context.entities.Consultation.update({
    where: { id: consultationId },
    data: { patientId },
    __auditUserId: context.user.id
  });
};

type ClearPatientFromConsultationArgs = {
  consultationId: number;
};

export const clearPatientFromConsultation = async (
  { consultationId }: ClearPatientFromConsultationArgs,
  context: any
) => {
  throwIfNotAuthenticated(context);

  // Team-based care: Any clinician can clear patient from any consultation
  const consultation = await context.entities.Consultation.findFirst({
    where: { id: consultationId }
  });

  if (!consultation) {
    throw new HttpError(404, 'Consultation not found');
  }

  // Clear patient from consultation
  return context.entities.Consultation.update({
    where: { id: consultationId },
    data: { patientId: null },
    __auditUserId: context.user.id
  });
};