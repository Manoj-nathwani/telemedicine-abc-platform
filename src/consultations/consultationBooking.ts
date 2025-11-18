import { HttpError } from "wasp/server";
import { prisma } from "wasp/server";
import { ERROR_CODES } from '../utils/errorCodes';
import { now, addMinutes, formatRelative } from "../utils/dateTime";
import { replaceSmsTemplate } from "../utils/emailTemplates";

interface BookingContext {
  entities: any;
  user?: any;
}

const validateRequest = async (
  context: BookingContext,
  consultationRequestId: number
) => {
  const consultationRequest = await context.entities.ConsultationRequest.findUnique({
    where: { id: consultationRequestId },
    include: { consultation: true }
  });

  if (!consultationRequest) {
    // This should never happen; throw a server error
    throw new Error(`ConsultationRequest with id ${consultationRequestId} not found`);
  }

  if (consultationRequest.status !== 'pending' || consultationRequest.consultation) {
    throw new HttpError(400, ERROR_CODES.CONSULTATION_REQUEST_ALREADY_ACCEPTED.message, {
      code: ERROR_CODES.CONSULTATION_REQUEST_ALREADY_ACCEPTED.code
    });
  }

  return consultationRequest;
};

const findSlot = async (
  context: BookingContext,
  triedSlotIds: number[],
  bufferTime: Date,
  userId?: number
) => {
  // Build where clause - filter by userId if provided
  const whereClause: any = {
    consultation: null,
    startDateTime: { gte: bufferTime }, // Only future slots
    user: {
      canHaveAvailability: true
    },
    ...(userId && { userId }), // Filter by user if specified
    ...(triedSlotIds.length > 0 && { id: { notIn: triedSlotIds } })
  };

  // Get available slots, filtered by userId if provided
  const availableSlots = await context.entities.Slot.findMany({
    where: whereClause,
    orderBy: { startDateTime: 'asc' },
    include: { user: true }
  });

  // Return the first available slot if found, or null if none
  return availableSlots.length > 0 ? availableSlots[0] : null;
};

const sendConsultationNotification = async (
  context: BookingContext,
  consultation: any,
  consultationRequest: any,
  templateBody: string
) => {
  // Get the consultation with slot details to format the time
  const consultationWithSlot = await context.entities.Consultation.findUnique({
    where: { id: consultation.id },
    include: { slot: true }
  });

  if (!consultationWithSlot) {
    throw new Error('Failed to retrieve consultation details for SMS notification');
  }

  // Format the consultation time for the SMS
  const consultationTime = formatRelative(
    consultationWithSlot.slot.startDateTime
  );

  const smsBody = replaceSmsTemplate(templateBody, { consultationTime });

  await context.entities.OutgoingSmsMessage.create({
    data: {
      phoneNumber: consultationRequest.phoneNumber,
      body: smsBody,
      sentByUserId: context.user.id,
    },
    __auditUserId: context.user.id
  });
};

const book = async (
  context: BookingContext,
  consultationRequestId: number,
  slot: any,
  templateBody: string,
  maxRetries: number = 3
) => {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Use an atomic transaction to prevent race conditions
      // Audit extension works inside transactions!
      const result = await prisma.$transaction(async (tx: any) => {
        // Get the consultation request to access patientDateOfBirth if it was provided during request
        const consultationRequest = await tx.consultationRequest.findUnique({
          where: { id: consultationRequestId }
        });

        if (!consultationRequest) {
          throw new Error(`ConsultationRequest with id ${consultationRequestId} not found`);
        }

        if (consultationRequest.status !== 'pending') {
          throw new HttpError(400, ERROR_CODES.CONSULTATION_REQUEST_ALREADY_ACCEPTED.message, {
            code: ERROR_CODES.CONSULTATION_REQUEST_ALREADY_ACCEPTED.code
          });
        }

        // Create consultation and update request status atomically
        const consultation = await tx.consultation.create({
          data: {
            assignedToUserId: slot.user.id,
            consultationRequestId: consultationRequestId,
            slotId: slot.id,
          },
          __auditUserId: context.user.id
        });

        await tx.consultationRequest.update({
          where: { id: consultationRequestId },
          data: { 
            status: "accepted",
            statusActionedByUserId: context.user.id
          },
          __auditUserId: context.user.id
        });

        return { consultation, consultationRequest };
      });

      // Send SMS notification to patient (outside transaction since it's not critical to booking)
      await sendConsultationNotification(context, result.consultation, result.consultationRequest, templateBody);

      return result.consultation;
    } catch (error: any) {
      // If unique constraint error (slot taken), retry
      if (error.code === 'P2002' && error.meta?.target?.includes('slotId')) {
        lastError = error;
        continue;
      }
      // Re-throw other errors
      throw error;
    }
  }
  throw lastError || new Error('Failed to book consultation after retries');
};

const handleConflict = async (
  context: BookingContext,
  triedSlotIds: number[]
) => {
  // Get all available slots, ordered by start time
  const availableSlots = await context.entities.Slot.findMany({
    where: {
      consultation: null,
      user: {
        canHaveAvailability: true
      },
      ...(triedSlotIds.length > 0 && { id: { notIn: triedSlotIds } })
    },
    orderBy: { startDateTime: 'asc' }
  });

  // Return the ID of the first available slot
  return availableSlots.length > 0 ? availableSlots[0].id : null;
};

/**
 * Main booking function
 */
export const bookConsultation = async (
  context: BookingContext,
  consultationRequestId: number,
  templateBody: string,
  assignToOnlyMe: boolean,
  maxRetries: number = 5
) => {
  // Validate the consultation request first
  await validateRequest(context, consultationRequestId);

  // Get buffer time from config
  const config = await context.entities.Config.findFirst();
  if (!config) {
    throw new Error('Failed to retrieve configuration for booking');
  }
  const bufferTime = addMinutes(now(), config.bufferTimeMinutes);
  const triedSlotIds: number[] = [];
  // If assignToOnlyMe is true, pass the current user's ID to findSlot
  const targetUserId = assignToOnlyMe ? context.user.id : undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Find an available slot (filtered by userId if assignToOnlyMe is true)
      const availableSlot = await findSlot(context, triedSlotIds, bufferTime, targetUserId);

      // If assignToOnlyMe is true but no slot found for user, throw user-friendly error
      if (assignToOnlyMe && !availableSlot) {
        throw new HttpError(400, 'You have no available slots. Please manage your availability first.', {
          code: ERROR_CODES.NO_AVAILABLE_SLOTS.code
        });
      }

      // If no slots found at all (not assigning to only me), throw error
      if (!availableSlot) {
        throw new HttpError(400, ERROR_CODES.NO_AVAILABLE_SLOTS.message, {
          code: ERROR_CODES.NO_AVAILABLE_SLOTS.code
        });
      }

      // Attempt to book the consultation
      return await book(context, consultationRequestId, availableSlot, templateBody);
    } catch (error: any) {
      // If the slot was taken by another request, add it to tried slots and retry
      if (error.code === 'P2002' && error.meta?.target?.includes('slotId')) {
        const attemptedSlotId = await handleConflict(context, triedSlotIds);

        if (attemptedSlotId) {
          triedSlotIds.push(attemptedSlotId);
        }

        // If this was our last attempt, throw an error
        if (attempt === maxRetries - 1) {
          throw new HttpError(400, ERROR_CODES.NO_AVAILABLE_SLOTS.message, {
            code: ERROR_CODES.NO_AVAILABLE_SLOTS.code
          });
        }

        // Continue to next attempt
        continue;
      }

      // Re-throw other errors immediately
      throw error;
    }
  }

  throw new HttpError(500, ERROR_CODES.BOOKING_FAILED.message, {
    code: ERROR_CODES.BOOKING_FAILED.code
  });
}; 