# External API Documentation

> HTTP endpoints for SMS service integration

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Endpoints](#endpoints)
  - [Create SMS Messages](#create-sms-messages)
  - [Get Outgoing Messages](#get-outgoing-messages)
  - [Mark Messages as Sent](#mark-messages-as-sent)
- [Error Handling](#error-handling)

## Overview

These REST API endpoints enable external SMS services to integrate with Telemedicine ABC for bidirectional message handling. The system receives incoming patient messages and provides outgoing messages for delivery.

## Authentication

All endpoints require API key authentication via the `X-API-Key` header.

### Environment Setup
```bash
# Set your API key in environment variables
SMS_API_KEY=your-secret-sms-api-key-here
```

### Request Headers
```http
X-API-Key: your-secret-sms-api-key-here
Content-Type: application/json
```

## Endpoints

### Create SMS Messages

**POST** `/api/sms/messages`

Creates SMS message records from external SMS services and automatically creates consultation requests.

#### Request Headers
```
X-API-Key: your-secret-sms-api-key-here
Content-Type: application/json
```

#### Request Body
```json
[
  {
    "sender": "+07000000000",
    "text": "heloooooooo",
    "createdAt": "2025-07-13 11:55:15"
  },
  {
    "sender": "+07000000001",
    "text": "Another message",
    "createdAt": "2025-07-13 12:00:00"
  }
]
```

**Note**: An empty array `[]` is also acceptable if there are no messages to create. Each message must include `sender`, `text`, and `createdAt` fields.

#### Example with curl
```bash
curl -X POST http://your-domain.com/api/sms/messages \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-sms-api-key-here" \
  -d '[
    {
      "sender": "+07000000000",
      "text": "heloooooooo",
      "createdAt": "2025-07-13 11:55:15"
    }
  ]'
```

#### Response
```json
{
  "success": true
}
```

**For empty array:**
```json
{
  "success": true
}
```

### Get Outgoing Messages

**GET** `/api/sms/outgoing-messages`

Retrieves all pending outgoing SMS messages that haven't been sent yet.

#### Request Headers
```
X-API-Key: your-secret-sms-api-key-here
```

#### Example with curl
```bash
curl -X GET http://your-domain.com/api/sms/outgoing-messages \
  -H "X-API-Key: your-secret-sms-api-key-here"
```

#### Response
```json
[
  {
    "id": 1,
    "phoneNumber": "+07000000000",
    "body": "Your consultation is confirmed for tomorrow at 2 PM"
  },
  {
    "id": 2,
    "phoneNumber": "+07000000001", 
    "body": "Please call us back to reschedule"
  }
]
```

### Mark Messages as Sent

**POST** `/api/sms/outgoing-messages`

Marks outgoing SMS messages as sent and creates corresponding SmsMessage records.

#### Request Headers
```
X-API-Key: your-secret-sms-api-key-here
Content-Type: application/json
```

#### Request Body
```json
{
  "ids": [1, 2, 3]
}
```

#### Example with curl
```bash
curl -X POST http://your-domain.com/api/sms/outgoing-messages \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-sms-api-key-here" \
  -d '{
    "ids": [1, 2, 3]
  }'
```

#### Response
```json
{
  "success": true
}
```

## Error Handling

### HTTP Status Codes

| Status | Description |
|--------|-------------|
| `200` | Success |
| `400` | Bad Request - Invalid data format or missing fields |
| `401` | Unauthorized - Missing or invalid API key |
| `500` | Internal Server Error |

### Error Response Format

All errors return JSON with an `error` field:

```json
{
  "error": "Description of the error"
}
```

### Common Error Examples

#### Validation Error
```json
{
  "error": "Validation error: sender: Sender is required, createdAt: Invalid createdAt format. Expected format: YYYY-MM-DD HH:MM:SS"
}
```

#### Authentication Error
```json
{
  "error": "Missing or invalid API key"
}
```

## Integration Notes

### Message Processing
- Incoming messages are stored with `direction: 'incoming'`
- Each incoming message automatically creates a `ConsultationRequest` with `status: 'pending'`
- Healthcare providers review requests via the web dashboard

### Outgoing Messages
- System queues outgoing messages for external SMS service pickup
- Messages remain in queue until marked as sent via the API
- Delivery status tracking (pending/success/failed) available

### Data Validation
- All endpoints use Zod schemas for request validation
- Detailed error messages provided for invalid data
- Date format: `YYYY-MM-DD HH:MM:SS`

### Best Practices
- Poll the outgoing messages endpoint regularly for timely delivery
- Mark messages as sent promptly to avoid duplicate deliveries
- Handle empty arrays gracefully (no messages to process)
- Implement proper error handling and retry logic 