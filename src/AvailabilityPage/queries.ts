import { throwIfNotAuthenticated } from '../utils/auth/server';
import { fromDate, endOfDay } from '../utils/dateTime';

type GetAvailabilityGridArgs = {
  date: string;
};

export const getAvailabilityGrid = async (
  { date }: GetAvailabilityGridArgs,
  context: any
) => {
  throwIfNotAuthenticated(context);

  // Parse the date string as start of day in configured timezone
  const dayStart = fromDate(date);
  const dayEnd = endOfDay(dayStart);

  // Get all users who can have availability
  const users = await context.entities.User.findMany({
    where: {
      canHaveAvailability: true,
      role: {
        not: 'system'
      }
    },
    select: {
      id: true,
      name: true,
      role: true,
      canHaveAvailability: true
    },
    orderBy: {
      name: 'asc'
    }
  });

  // Get all slots for this date
  const slots = await context.entities.Slot.findMany({
    where: {
      startDateTime: {
        gte: dayStart,
        lte: dayEnd
      },
      user: {
        canHaveAvailability: true
      }
    },
    include: {
      user: {
        select: {
          id: true,
          name: true
        }
      },
      consultation: {
        select: {
          id: true,
          consultationRequest: {
            select: {
              phoneNumber: true,
              description: true,
              status: true
            }
          }
        }
      }
    },
    orderBy: {
      startDateTime: 'asc'
    }
  });

  return {
    users,
    slots
  };
};