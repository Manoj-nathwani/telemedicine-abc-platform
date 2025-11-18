import { addEmailToUsers } from '../../utils/auth/client';
import { throwIfNotAdmin } from '../../utils/auth/server';

export const getUsers = async (_args: any, context: any) => {
  throwIfNotAdmin(context.user);

  const { entities: { User } } = context

  const users = await User.findMany({
    where: {
      auth: {
        identities: {
          some: {}
        }
      }
    },
    include: {
      auth: {
        include: {
          identities: true
        }
      }
    },
    orderBy: { id: 'asc' }
  })

  // Add email field from auth identity
  return addEmailToUsers(users);
}