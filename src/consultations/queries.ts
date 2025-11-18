import { type ConsultationRequest } from "wasp/entities";
import { type GetConsultationRequests } from "wasp/server/operations";
import { type ConsultationRequestStatus } from "@prisma/client";
import { type ConsultationWithCalls } from './types';
import { throwIfNotAuthenticated } from "../utils/auth/server";
import { parse } from "../utils/dateTime";

export const getConsultationRequests = ((args: { status?: string } | undefined, context: any) => {
  throwIfNotAuthenticated(context);

  const status = args?.status as ConsultationRequestStatus | undefined;

  return context.entities.ConsultationRequest.findMany({
    where: status ? { status } : undefined,
    include: {
      consultation: {
        select: {
          id: true,
          createdAt: true,
          slot: {
            select: {
              id: true,
              startDateTime: true,
              endDateTime: true,
              user: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      },
      statusActionedBy: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}) satisfies GetConsultationRequests<{ status?: string } | undefined, ConsultationRequest[]>;

export const getConsultationWithCalls = async (
  { consultationId }: { consultationId: number },
  context: any
): Promise<ConsultationWithCalls | null> => {
  throwIfNotAuthenticated(context);

  // Team-based care: Any clinician can view any consultation
  return context.entities.Consultation.findFirst({
    where: { id: consultationId },
    include: {
      patient: {
        include: {
          consultations: {
            select: {
              id: true,
              createdAt: true
            },
            orderBy: {
              createdAt: 'desc'
            }
          }
        }
      },
      consultationRequest: {
        include: {
          statusActionedBy: {
            select: {
              id: true,
              name: true
            }
          }
        }
      },
      slot: {
        include: {
          user: true
        }
      },
      calls: {
        include: {
          conductedBy: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'asc'
        }
      },
      outgoingSmsMessages: {
        orderBy: {
          createdAt: 'desc'
        }
      }
    }
  });
};


export const searchPatients = async (
  { phoneNumber, dateOfBirth }: { phoneNumber: string; dateOfBirth: string },
  context: any
) => {
  throwIfNotAuthenticated(context);

  const conditions: any[] = [];
  let phoneNumberMatches = false;

  // If phone number is provided, find patients through consultations
  if (phoneNumber) {
    const consultationsWithPhone = await context.entities.Consultation.findMany({
      where: {
        consultationRequest: {
          phoneNumber: phoneNumber
        }
      },
      include: {
        patient: true
      }
    });

    const patientIds = consultationsWithPhone
      .map((c: any) => c.patient?.id)
      .filter(Boolean);

    if (patientIds.length > 0) {
      conditions.push({ id: { in: patientIds } });
      phoneNumberMatches = true;
    } else if (!dateOfBirth) {
      // No patients found with this phone number and no DOB to search by
      return [];
    }
  }

  // Search by date of birth (convert string to Date object)
  if (dateOfBirth) {
    const dobDate = parse(dateOfBirth);
    conditions.push({ dateOfBirth: dobDate });
  }

  // If no search criteria at all, return empty
  if (conditions.length === 0) {
    return [];
  }

  const patients = await context.entities.Patient.findMany({
    where: {
      AND: conditions
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  // Add phoneNumberMatches flag to each patient
  return patients.map((patient: any) => ({
    ...patient,
    phoneNumberMatches
  }));
};

export const getPatientsWithConsultations = async (
  args: any,
  context: any
) => {
  throwIfNotAuthenticated(context);

  return context.entities.Patient.findMany({
    include: {
      consultations: {
        include: {
          consultationRequest: {
            select: {
              id: true,
              description: true,
              phoneNumber: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
};