export const getConfig = async (_args: void, context: any): Promise<{
  consultationDurationMinutes: number,
  breakDurationMinutes: number,
  bufferTimeMinutes: number,
  consultationSmsTemplates: Array<{ name: string; body: string }>
}> => {
  // Anyone logged in can read config
  const config = await context.entities.Config.findFirst();
  if (!config) throw new Error('Config not found');
  return config;
}; 