import { addEmailToUsers } from '../../utils/auth/client';

export const getUserById = async (args: { userId: number }, context: any) => {
  const { entities: { User } } = context;

  const user = await User.findUnique({
    where: { id: args.userId },
    include: {
      auth: {
        include: {
          identities: true
        }
      }
    }
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Add email field from auth identity
  return addEmailToUsers([user])[0];
};

