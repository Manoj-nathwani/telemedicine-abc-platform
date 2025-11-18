import { HttpError } from 'wasp/server';
import { now, parse } from '../../utils/dateTime';
import { z } from 'zod';
import { validateApiKey } from '../../utils/api';
import { SMS_SERVICE_USER } from '../../constants';

// Zod schema for SMS message validation
const SmsMessageSchema = z.object({
  sender: z.string().min(1, 'Sender is required'),
  text: z.string().min(1, 'Text is required'),
  createdAt: z.string().min(1, 'CreatedAt is required').refine(
    (val) => {
      try {
        const date = parse(val);
        return !isNaN(date.valueOf());
      } catch {
        return false;
      }
    },
    'Invalid createdAt format. Expected ISO-8601 format.'
  )
});

// Zod schema for request body validation
const RequestBodySchema = z.array(SmsMessageSchema);

// Zod schema for marking outgoing message as sent
const MarkOutgoingMessageAsSentSchema = z.object({
  id: z.number().int().positive('Message ID must be a positive integer'),
  success: z.boolean(),
});

export const createSmsMessagesApiHandler = async (req: any, res: any, context: any) => {
  try {
    if (!process.env.SMS_API_KEY) throw new Error('SMS_API_KEY env variable is not set');
    validateApiKey(req, process.env.SMS_API_KEY);

    // Validate request body using Zod
    const messages = RequestBodySchema.parse(req.body);

    // Parse all timestamps and prepare data for database
    const processedMessages = messages.map(message => {
      const createdAt = parse(message.createdAt);

      return {
        phoneNumber: message.sender,
        body: message.text,
        direction: 'incoming',
        createdAt
      };
    });

    // Create all messages and consultation requests sequentially
    for (const message of processedMessages) {
      // 1. Create SMS message
      await context.entities.SmsMessage.create({
        data: message,
        __auditUserId: SMS_SERVICE_USER.id
      });

      // 2. Create consultation request
      await context.entities.ConsultationRequest.create({
        data: {
          phoneNumber: message.phoneNumber,
          description: message.body
        },
        __auditUserId: SMS_SERVICE_USER.id
      });
    }

    res.json({ success: true });
  } catch (error: any) {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ error: error.message });
    } else if (error instanceof z.ZodError) {
      // Handle Zod validation errors
      const errorMessage = error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      res.status(400).json({ error: `Validation error: ${errorMessage}` });
    } else {
      console.error('SMS API Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

export const getOutgoingMessagesApiHandler = async (req: any, res: any, context: any) => {
  try {
    if (!process.env.SMS_API_KEY) throw new Error('SMS_API_KEY env variable is not set');
    validateApiKey(req, process.env.SMS_API_KEY);

    // Query all OutgoingSmsMessage records that are pending sending (success is null)
    const outgoingMessages = await context.entities.OutgoingSmsMessage.findMany({
      where: { success: null },
      select: { id: true, phoneNumber: true, body: true }
    });

    res.json(outgoingMessages);
  } catch (error: any) {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ error: error.message });
    } else if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
      res.status(400).json({ error: `Validation error: ${errorMessage}` });
    } else {
      console.error('SMS API Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

export const markOutgoingMessageAsSentApiHandler = async (req: any, res: any, context: any) => {
  try {
    if (!process.env.SMS_API_KEY) throw new Error('SMS_API_KEY env variable is not set');
    validateApiKey(req, process.env.SMS_API_KEY);

    // Validate request body
    const { id, success } = MarkOutgoingMessageAsSentSchema.parse(req.body);

    const outgoingMessage = await context.entities.OutgoingSmsMessage.findUnique({
      where: { id }
    });

    if (!outgoingMessage) {
      throw new HttpError(404, 'Outgoing message not found');
    }

    // Only create SmsMessage if the message was sent successfully
    if (success) {
      // Create the actual SmsMessage that was sent (received/handled by SMS_SERVICE_USER)
      const sentMessage = await context.entities.SmsMessage.create({
        data: {
          phoneNumber: outgoingMessage.phoneNumber,
          body: outgoingMessage.body,
          direction: 'outgoing',
          createdAt: now() // When it was actually sent
        },
        __auditUserId: SMS_SERVICE_USER.id
      });

      // Link the OutgoingSmsMessage to the sent SmsMessage
      await context.entities.OutgoingSmsMessage.update({
        where: { id },
        data: {
          sentMessageId: sentMessage.id,
          success: true
        },
        __auditUserId: SMS_SERVICE_USER.id
      });
    } else {
      // Mark as failed
      await context.entities.OutgoingSmsMessage.update({
        where: { id },
        data: { success: false },
        __auditUserId: SMS_SERVICE_USER.id
      });
    }

    res.json({ success: true });
  } catch (error: any) {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ error: error.message });
    } else if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
      res.status(400).json({ error: `Validation error: ${errorMessage}` });
    } else {
      console.error('SMS API Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

