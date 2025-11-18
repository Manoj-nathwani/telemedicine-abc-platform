import { BRAND_NAME } from '../constants'

export interface EmailTemplate {
  subject: string
  text: string
  html: string
}

const createEmailTemplate = (title: string, greeting: string, message: string, buttonText: string, passwordResetLink: string, footer?: string) => ({
  subject: title,
  text: `Hello,\n\n${message}\n\n${passwordResetLink}\n\nBest regards,\n${BRAND_NAME}`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #d63384; text-align: center;">${title}</h2>
      <p>${greeting}</p>
      <p>${message}</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${passwordResetLink}" 
           style="background-color: #d63384; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
          ${buttonText}
        </a>
      </div>
      ${footer ? `<p style="font-size: 14px; color: #666;">${footer}</p>` : ''}
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="text-align: center; color: #666; font-size: 14px;">
        Best regards,<br>${BRAND_NAME}
      </p>
    </div>
  `
})

export const createUserInvitationEmail = (name: string, passwordResetLink: string) =>
  createEmailTemplate(
    `Welcome to - ${BRAND_NAME}`,
    `Hello ${name},`,
    `You have been invited to join ${BRAND_NAME}. Please click the button below to set your password:`,
    'Welcome',
    passwordResetLink
  )

export const getPasswordResetEmailContent = ({ passwordResetLink }: { passwordResetLink: string }) =>
  createEmailTemplate(
    `Reset Your Password - ${BRAND_NAME}`,
    'Hello,',
    `You requested a password reset for your ${BRAND_NAME} account. Please click the button below to reset your password:`,
    'Reset Password',
    passwordResetLink,
    'This link will expire in 24 hours for security reasons.\n\nIf you didn\'t request this password reset, please ignore this email.'
  )

export const getEmailVerificationContent = ({ verificationLink }: { verificationLink: string }) => {
  throw new Error('Email verification is disabled in this application. Users do not need to verify their email addresses.')
}

export const replaceSmsTemplate = (template: string, replacements: Record<string, string>): string => {
  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`{${key}}`, 'g'), value);
  }
  return result;
};

