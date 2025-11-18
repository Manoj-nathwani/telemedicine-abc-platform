import { type Slot } from "wasp/entities";
import { HttpError } from "wasp/server";
import { fromDate, fromDateTime, isAfter, endOfDay } from "../utils/dateTime";
import { throwIfNotAuthenticated, throwIfNotAdmin } from "../utils/auth/server";

type BulkUpdateSlotsArgs = {
  date: string;
  userId?: number; // Optional - if not provided, uses current user
  slots: Array<{
    startTime: string;
    endTime: string;
  }>;
};

export const bulkUpdateSlots = async (
  { date, userId, slots }: BulkUpdateSlotsArgs,
  context: any
) => {
  throwIfNotAuthenticated(context);

  // Determine target user ID
  const targetUserId = userId || context.user.id;

  const targetUser = await context.entities.User.findUnique({
    where: { id: targetUserId }
  });

  if (!targetUser) {
    throw new HttpError(404, 'User not found');
  }

  // If updating another user's slots, check admin permissions
  if (targetUserId !== context.user.id) {
    throwIfNotAdmin(context.user);
  }

  if (!targetUser.canHaveAvailability) {
    throw new HttpError(400, 'This user cannot manage availability.');
  }

  // Parse the date string as start of day in configured timezone
  const dayStart = fromDate(date);
  const dayEnd = endOfDay(dayStart);

  // Delete existing unbooked slots for this date
  await context.entities.Slot.deleteMany({
    where: {
      userId: targetUserId,
      startDateTime: {
        gte: dayStart,
        lte: dayEnd
      },
      consultation: null
    }
  });

  // Create new slots
  const newSlots: Slot[] = [];
  for (const slotData of slots) {
    // Validate time format before parsing
    if (!slotData.startTime || !slotData.endTime) {
      throw new HttpError(400, 'Start time and end time are required');
    }
    
    // Validate time string format (HH:mm)
    const timeFormat = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeFormat.test(slotData.startTime) || !timeFormat.test(slotData.endTime)) {
      throw new HttpError(400, 'Invalid time format. Expected HH:mm format');
    }

    // Create timestamps from date and time strings
    const startDateTime = fromDateTime(date, slotData.startTime);
    const endDateTime = fromDateTime(date, slotData.endTime);

    // Validate that end time is after start time
    if (!isAfter(endDateTime, startDateTime)) {
      throw new HttpError(400, 'End time must be after start time');
    }

    const newSlot = await context.entities.Slot.create({
      data: {
        startDateTime,
        endDateTime,
        userId: targetUserId
      },
      __auditUserId: context.user.id
    });
    newSlots.push(newSlot);
  }

  return newSlots;
};