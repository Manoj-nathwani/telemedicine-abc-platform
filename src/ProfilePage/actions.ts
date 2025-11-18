import { HttpError } from 'wasp/server';
import { throwIfNotAuthenticated, throwIfNotAdmin } from '../utils/auth/server';

export const updateUserProfile = async (args: any, context: any) => {
  throwIfNotAuthenticated(context);

  const { name, email, role } = args;
  const { entities: { User } } = context;

  // Only allow role changes if user is admin
  if (role && role !== context.user.role) {
    throwIfNotAdmin(context.user);
  }

  // Check if email is already taken by another user
  if (email) {
    const existingUser = await User.findFirst({
      where: {
        auth: {
          identities: {
            some: {
              providerName: 'email',
              providerUserId: email
            }
          }
        },
        id: { not: context.user.id }
      }
    });

    if (existingUser) {
      throw new HttpError(400, 'Email is already in use by another user');
    }
  }

  // Update user profile (only name and role, email is managed by Wasp auth)
  return await User.update({
    where: { id: context.user.id },
    data: { name, role },
    __auditUserId: context.user.id
  });
}; 