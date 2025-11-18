import { z } from 'zod';
import { HttpError } from 'wasp/server';

// Zod schema for API key in headers
const ApiKeyHeaderSchema = z.object({
  'x-api-key': z.string().min(1, 'X-API-Key header is required'),
});

/**
 * Validates API key from headers or body and throws HttpError if invalid.
 * @param req Express request object
 * @param expectedApiKey The API key to check against (from env)
 * @param options Optional: { location: 'header' | 'body', headerName?: string, bodyKey?: string }
 * @returns The validated API key string
 */
export function validateApiKey(req: any, expectedApiKey: string, options?: { location?: 'header' | 'body', headerName?: string, bodyKey?: string }) {
  const location = options?.location || 'header';
  if (location === 'header') {
    const headerName = options?.headerName || 'x-api-key';
    const validatedHeaders = ApiKeyHeaderSchema.parse({
      'x-api-key': req.headers[headerName] || req.headers['api-key']
    });
    const apiKey = validatedHeaders['x-api-key'];
    if (apiKey !== expectedApiKey) {
      throw new HttpError(401, 'Invalid API key');
    }
    return apiKey;
  } else if (location === 'body') {
    const bodyKey = options?.bodyKey || 'apiKey';
    const apiKey = req.body?.[bodyKey];
    if (!apiKey) {
      throw new HttpError(400, `Missing required field: ${bodyKey}`);
    }
    if (apiKey !== expectedApiKey) {
      throw new HttpError(401, 'Invalid API key');
    }
    return apiKey;
  } else {
    throw new HttpError(500, 'Invalid API key validation location');
  }
} 