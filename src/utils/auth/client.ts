/**
 * Gets the email address for a user from their authentication identity
 */
export function getUserEmail(user: any): string | null {
  return user.auth?.identities.find((i: any) => i.providerName === 'email')?.providerUserId || null;
}

/**
 * Adds email field to user objects from their auth identities
 */
export function addEmailToUsers(users: any[]): any[] {
  return users.map(user => ({
    ...user,
    email: getUserEmail(user)
  }));
}

/**
 * Checks if a user with the given email already exists
 */
export async function checkUserExistsByEmail(User: any, email: string): Promise<boolean> {
  const existingUser = await User.findFirst({
    where: {
      auth: {
        identities: {
          some: {
            providerName: 'email',
            providerUserId: email
          }
        }
      }
    }
  });
  
  return !!existingUser;
}


/**
 * Gets the current authenticated user with all necessary fields
 */
export const getUser = async (_args: any, context: any) => {
  if (!context.user) {
    throw new Error('Not authenticated');
  }

  const { entities: { User } } = context;

  const user = await User.findUnique({
    where: { id: context.user.id },
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

  // Add email field to user object
  return {
    ...user,
    email: getUserEmail(user)
  };
}; 

export const isAdmin = (user: { role: string } | null | undefined): boolean => {
  return user?.role === 'admin';
};
