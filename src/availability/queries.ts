import { HttpError } from "wasp/server";
import { fromDate, endOfDay } from "../utils/dateTime";
import { throwIfNotAuthenticated } from "../utils/auth/server";

type GetSlotsByDateArgs = {
  date: string;
  userId?: number;
};

export const getSlotsByDate = async (
  { date, userId }: GetSlotsByDateArgs,
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

  // Parse the date string as start of day in configured timezone
  const dayStart = fromDate(date);
  const dayEnd = endOfDay(dayStart);

  return context.entities.Slot.findMany({
    where: {
      userId: targetUserId,
      startDateTime: {
        gte: dayStart,
        lte: dayEnd
      }
    },
    orderBy: { startDateTime: 'asc' },
    include: {
      consultation: {
        select: {
          id: true,
          consultationRequest: {
            select: {
              phoneNumber: true,
              description: true
            }
          }
        }
      }
    }
  });
};