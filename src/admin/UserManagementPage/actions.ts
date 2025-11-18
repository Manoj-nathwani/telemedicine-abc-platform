import { HttpError } from 'wasp/server';
import { now } from '../../utils/dateTime';
import { createPasswordResetLink, sendPasswordResetEmail } from 'wasp/server/auth';
import { createUserInvitationEmail } from '../../utils/emailTemplates';
import { checkUserExistsByEmail } from '../../utils/auth/client';
import { throwIfNotAdmin } from '../../utils/auth/server';

const findUser = async (User: any, id: number) => {
  const user = await User.findUnique({ where: { id } })
  if (!user) throw new HttpError(404, 'User not found')
  return user
}

export const createUser = async (args: any, context: any) => {
  throwIfNotAdmin(context.user)

  const { name, email, role } = args
  const { entities: { User } } = context

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new HttpError(400, 'Invalid email format');
  }

  // Check if a user with this email already exists
  const userExists = await checkUserExistsByEmail(User, email);
  if (userExists) throw new HttpError(400, 'User with this email already exists')

  const user = await User.create({
    data: {
      name, role,
      auth: {
        create: {
          identities: {
            create: {
              providerName: 'email',
              providerUserId: email,
              providerData: JSON.stringify({
                hashedPassword: null,
                passwordResetSentAt: null,
                isEmailVerified: true,
                emailVerificationSentAt: now()
              }),
            }
          }
        }
      }
    },
    include: { auth: true },
    __auditUserId: context.user.id
  })

  const passwordResetLink = await createPasswordResetLink(email, '/password-reset')
  const emailTemplate = createUserInvitationEmail(name, passwordResetLink)
  if (process.env.NODE_ENV === 'production') {
    await sendPasswordResetEmail(email, {
      to: email,
      ...emailTemplate
    })
  }

  return user
}



export const updateUserRole = async (args: any, context: any) => {
  throwIfNotAdmin(context.user)
  
  const { userId, role } = args
  const { entities: { User } } = context
  const userToUpdate = await findUser(User, userId)

  if (userToUpdate.id === context.user.id) throw new HttpError(403, 'Cannot change your own role')

  return await User.update({
    where: { id: userId },
    data: { role },
    __auditUserId: context.user.id
  })
}

export const resendInvitation = async (args: any, context: any) => {
  throwIfNotAdmin(context.user)
  
  const { userId } = args
  const { entities: { User } } = context
  const user = await findUser(User, userId)

  // Get the email from the auth identity by querying the user with auth data
  const userWithAuth = await User.findUnique({
    where: { id: userId },
    include: {
      auth: {
        include: {
          identities: {
            where: { providerName: 'email' }
          }
        }
      }
    }
  })

  const email = userWithAuth?.auth?.identities[0]?.providerUserId
  if (!email) {
    throw new HttpError(400, 'User has no email identity')
  }

  const passwordResetLink = await createPasswordResetLink(email, '/password-reset')
  const emailTemplate = createUserInvitationEmail(user.name, passwordResetLink)
  
  await sendPasswordResetEmail(email, {
    to: email,
    ...emailTemplate
  })
  
  return { success: true }
}

export const updateUserAvailabilityEnabled = async (args: any, context: any) => {
  throwIfNotAdmin(context.user);

  const { userId, canHaveAvailability } = args;
  const { entities: { User, Slot } } = context;
  await findUser(User, userId);

  if (!canHaveAvailability) {
    const upcomingBookedConsultations = await Slot.count({
      where: {
        userId,
        consultation: {
          isNot: null
        },
        startDateTime: {
          gte: now()
        }
      }
    });

    if (upcomingBookedConsultations > 0) {
      throw new HttpError(400, `User still has ${upcomingBookedConsultations} upcoming consultations.`);
    }

    await Slot.deleteMany({
      where: {
        userId,
        consultation: null,
        startDateTime: {
          gte: now()
        }
      }
    });
  }

  return await User.update({
    where: { id: userId },
    data: { canHaveAvailability },
    __auditUserId: context.user.id
  });
};

export const sendSmsMessage = async (args: { phoneNumber: string; body: string }, context: any) => {
  throwIfNotAdmin(context.user);

  return context.entities.OutgoingSmsMessage.create({
    data: {
      phoneNumber: args.phoneNumber,
      body: args.body,
      sentByUserId: context.user.id,
    },
    __auditUserId: context.user.id
  });
}; 