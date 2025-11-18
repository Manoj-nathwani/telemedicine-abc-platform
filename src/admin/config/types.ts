import * as z from 'zod';

// Template structure
export const smsTemplateSchema = z.object({
  name: z.string().min(1, 'Template name cannot be empty'),
  body: z.string().min(1, 'Template body cannot be empty').max(500, 'Template body must be 500 characters or less'),
});

export type SmsTemplate = z.infer<typeof smsTemplateSchema>;

// Zod schema for Config model (excluding auto-generated fields)
export const configUpdateSchema = z.object({
  consultationDurationMinutes: z.number()
    .int()
    .min(1, 'Must be at least 1 minute')
    .max(120, 'Must be 120 minutes or less'),
  breakDurationMinutes: z.number()
    .int()
    .min(0, 'Must be 0 or more minutes')
    .max(60, 'Must be 60 minutes or less'),
  bufferTimeMinutes: z.number()
    .int()
    .min(0, 'Must be 0 or more minutes'),
  consultationSmsTemplates: z.array(smsTemplateSchema).min(1, 'At least one template is required'),
});

export type ConfigUpdateData = z.infer<typeof configUpdateSchema>;

// Form field configuration derived from the schema
// Note: Templates are managed separately, not via AutoForm
export const configFormFields = [
  {
    key: 'consultationDurationMinutes' as keyof ConfigUpdateData,
    label: 'Consultation Duration (minutes)',
    type: 'number',
    min: 1,
    max: 120,
  },
  {
    key: 'breakDurationMinutes' as keyof ConfigUpdateData,
    label: 'Break Duration (minutes)',
    type: 'number',
    min: 0,
    max: 60,
  },
  {
    key: 'bufferTimeMinutes' as keyof ConfigUpdateData,
    label: 'Buffer Time (minutes)',
    type: 'number',
    min: 0,
  },
] as const;

// Validation helper
export const validateConfigUpdate = (data: unknown): ConfigUpdateData => {
  return configUpdateSchema.parse(data);
};

// Convert Config entity to form data
export const configToFormData = (config: {
  consultationDurationMinutes: number;
  breakDurationMinutes: number;
  bufferTimeMinutes: number;
  consultationSmsTemplates: Array<{ name: string; body: string }>;
}): ConfigUpdateData => {
  return {
    consultationDurationMinutes: config.consultationDurationMinutes,
    breakDurationMinutes: config.breakDurationMinutes,
    bufferTimeMinutes: config.bufferTimeMinutes,
    consultationSmsTemplates: config.consultationSmsTemplates,
  };
}; 