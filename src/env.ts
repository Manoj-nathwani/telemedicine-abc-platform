import * as z from 'zod'
import { defineEnvValidationSchema } from 'wasp/env'

export const serverEnvValidationSchema = defineEnvValidationSchema(
    z.object({
        MAILGUN_API_KEY: z.string({
            required_error: 'MAILGUN_API_KEY is required.',
        }).min(1, 'MAILGUN_API_KEY cannot be empty.'),
        MAILGUN_DOMAIN: z.string({
            required_error: 'MAILGUN_DOMAIN is required.',
        }).min(1, 'MAILGUN_DOMAIN cannot be empty.'),
        SMS_API_KEY: z.string({
            required_error: 'SMS_API_KEY is required.',
        }).min(1, 'SMS_API_KEY cannot be empty.'),
        ADMIN_EMAIL: z.string().email().optional()
    })
)

export const clientEnvValidationSchema = defineEnvValidationSchema(
    z.object({
        REACT_APP_API_URL: z.string().optional(),
        REACT_APP_REDIRECT_URL: z.string(),
    })
) 