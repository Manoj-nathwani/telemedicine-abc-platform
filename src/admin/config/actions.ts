import { throwIfNotAdmin } from '../../utils/auth/server';

type UpdateConfigArgs = {
  consultationDurationMinutes: number;
  breakDurationMinutes: number;
  bufferTimeMinutes: number;
  consultationSmsTemplates: Array<{ name: string; body: string }>;
};

export const updateConfig = async (args: UpdateConfigArgs, context: any) => {
  throwIfNotAdmin(context.user);
  // Upsert config (always keep only one row)
  const config = await context.entities.Config.upsert({
    where: { id: 1 },
    update: {
      consultationDurationMinutes: args.consultationDurationMinutes,
      breakDurationMinutes: args.breakDurationMinutes,
      bufferTimeMinutes: args.bufferTimeMinutes,
      consultationSmsTemplates: args.consultationSmsTemplates
    },
    create: {
      id: 1,
      consultationDurationMinutes: args.consultationDurationMinutes,
      breakDurationMinutes: args.breakDurationMinutes,
      bufferTimeMinutes: args.bufferTimeMinutes,
      consultationSmsTemplates: args.consultationSmsTemplates
    },
    __auditUserId: context.user.id
  });
  return config;
}; 