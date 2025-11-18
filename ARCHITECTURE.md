# Architecture Overview

System design and technical architecture for Telemedicine ABC.

## System Overview

SMS-to-phone telemedicine platform for LMICs. Patients send SMS with symptoms; healthcare providers review on web dashboard, conduct phone consultations, and send follow-up SMS.

## Core Entities

### 1. SmsMessage
- **Purpose**: Records all incoming and outgoing messages
- **Direction**: incoming (from patients) or outgoing (to patients)
- **Key Fields**: phoneNumber, body, direction, createdAt
- **Relations**: Links to OutgoingSmsMessage for delivery tracking

### 2. ConsultationRequest
- **Purpose**: Patient requests for consultations (created from incoming messages)
- **Status**: pending → accepted/rejected
- **Key Fields**: phoneNumber, description, status
- **Relations**: One-to-one with Consultation (if accepted)

### 3. Consultation
- **Purpose**: Scheduled phone consultation between patient and provider
- **Key Fields**: assignedToUserId (from slot assignment), multiple calls/outcomes
- **Relations**: Links to ConsultationRequest, Slot, User (assigned), ConsultationCalls, and OutgoingSmsMessages
- **Team-based**: Any clinician can view/work on any consultation, assignment is for scheduling only

### 4. Slot
- **Purpose**: Provider availability slots for phone consultations
- **Key Fields**: startDateTime, endDateTime
- **Relations**: Links to User (owner) and Consultation (if booked)

### 5. ConsultationCall
- **Purpose**: Records phone calls made for consultations
- **Status**: patient_answered, patient_no_answer, clinician_did_not_call
- **Key Fields**: status, confirmations, chiefComplaint, diagnosis, prescriptions, followUp
- **Relations**: Links to Consultation and User (conductedBy)

### 6. OutgoingSmsMessage
- **Purpose**: Queued messages to be sent to patients
- **Status**: pending (null), success (true), failed (false)
- **Key Fields**: phoneNumber, body, success
- **Relations**: Links to SmsMessage (when sent) and Consultation

### 7. User
- **Purpose**: Healthcare providers and administrators
- **Roles**: admin, clinician, system (for automated operations)
- **Relations**:
  - Has many Slots (personal availability)
  - Assigned to many Consultations (via slot assignment)
  - Conducted many ConsultationCalls (who made the call)
  - Sent many OutgoingSmsMessages (who sent SMS)

## Workflow

1. **Patient SMS** → Creates `ConsultationRequest` (pending)
2. **Provider triage** → Accept/reject request
3. **Accept** → Creates `Consultation`, assigns to `Slot`, sends confirmation SMS
4. **Phone call** → Clinician creates `ConsultationCall` with clinical notes
5. **Follow-up** → Optional `OutgoingSmsMessage` with prescriptions/advice

## Entity Relationship Flow

```
SmsMessage (incoming) 
    ↓ triggers creation
ConsultationRequest (pending)
    ↓ when accepted
Consultation ←→ Slot (clinician availability)
    ↓ after phone call
ConsultationCall → OutgoingSmsMessage (follow-up)
    ↓ when sent
SmsMessage (outgoing)
```

## Database Design

### Schema Overview
```sql
-- Core entities with clear relationships
SmsMessage (id, phoneNumber, body, direction, createdAt)
ConsultationRequest (id, phoneNumber, description, status, createdAt)
Consultation (id, patientId, assignedToUserId, consultationRequestId, slotId)
Slot (id, startDateTime, endDateTime, userId)
ConsultationCall (id, consultationId, conductedByUserId, status, confirmations, chiefComplaint, diagnosis, prescriptions, followUp)
OutgoingSmsMessage (id, phoneNumber, body, success, consultationId, sentByUserId)
User (id, name, role)
```

### Key Relationships
- **One-to-One**: ConsultationRequest ↔ Consultation
- **One-to-One**: Consultation ↔ Slot (when booked)
- **One-to-Many**: Consultation → ConsultationCalls (multiple calls per consultation)
- **One-to-Many**: User → Consultations (assigned), Slots (owned), ConsultationCalls (conducted)

### Authorization Model

**Team-Based Care - No Ownership Restrictions:**
- ✅ **Shared Resources**: All clinicians can view/modify ConsultationRequests, Consultations, ConsultationCalls, OutgoingSmsMessages, and Patients
- ✅ **Personal Resources**: Clinicians can only create/modify/delete their own Slots
- ✅ **Accountability**: All actions tracked via semantic field names (assignedToUserId, conductedByUserId, sentByUserId)
- ✅ **Principle**: Assignment ≠ Ownership - consultations assigned to slots for scheduling, but any clinician can help

**Why Team-Based?**
- Enables flexible coverage when clinicians are unavailable
- Supports handoffs and collaboration during busy periods
- Maintains accountability while removing blockers
- Reflects real-world healthcare team dynamics

### Data Protection
- **Delete blocking**: Healthcare data (Patient, Consultation, SMS, etc.) cannot be deleted
- **Slot exception**: Unbooked availability slots can be deleted (not medical records)
- **Implementation**: Prisma Client Extension in `src/prismaSetup.ts`

## API

See `main.wasp` for queries and actions. Key operations: accept/reject consultation requests, create consultation calls, manage availability slots.

## Design Principles

- **Simplicity**: Single-purpose entities, simple status enums, straightforward data flow
- **Reliability**: One-to-one relationships with unique constraints, first-available slot assignment
- **Team-based care**: Any clinician can work on any consultation (assignment is for scheduling only)
- **Wasp-First**: Declarative routing/auth in `main.wasp`, Query/Action pattern, Prisma ORM 