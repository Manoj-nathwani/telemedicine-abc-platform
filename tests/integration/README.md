# Integration Tests

Real API integration tests with no mocking - tests hit actual endpoints and database.

## Quick Start

```bash
npm test                    # Run all integration tests
npm test -- 1-full-workflow # Run specific test file
```

**Prerequisites**: Development server must be running (`npm run dev`)

## Test Organization

Tests follow a 4-level hierarchy from simple to complex:

| Level | Pattern | Purpose | Files |
|-------|---------|---------|-------|
| 1 | `1-*.test.js` | Smoke tests - full happy paths | 1-full-workflow.test.js |
| 2 | `2.*.test.js` | Entity-specific workflows | consultation-lifecycle, slot-management, sms-workflows, sms-api |
| 3 | `3-*.test.js` | Authorization & team-based care | 3-authorization.test.js |
| 4 | `4-*.test.js` | Edge cases & error handling | 4-edge-cases.test.js |
| 5 | `5-*.test.js` | Compliance & audit logging | 5-audit-logging.test.js |

**Rule**: If Level 1 fails, fix it before investigating other levels.

## Test Isolation Strategy

Each test file uses unique phone number ranges to prevent conflicts:

- `1-full-workflow.test.js`: 1000-1099
- `2.1-consultation-lifecycle.test.js`: 2000-2099
- `2.2-slot-management.test.js`: 3000-3099
- `2.3-sms-workflows.test.js`: 4000-4999
- `2.4-sms-api.test.js`: 5000-5999
- `3-authorization.test.js`: 6000-6099
- `4-edge-cases.test.js`: 7000-7099
- `5-audit-logging.test.js`: 8000-8099

Tests use `getTomorrowDateString()` for date isolation.

## Common Patterns

### Complete workflow (accept → patient → call with outcome)
```javascript
const result = await completeConsultationWorkflow(
  sessionId,
  phoneIndex,
  dateStr
);
// Returns: { consultationId, callId, patientId, phoneNumber }
// Note: SMS sending is separate - clinicians manually send via UI
```

### Just accept consultation (no patient or call)
```javascript
const { consultationId, phoneNumber } = await acceptConsultationOnly(
  sessionId,
  phoneIndex,
  dateStr
);
```

See [helpers/workflows.js](helpers/workflows.js) for all available helpers.

## Authorization Testing

**Team-Based Care Model**: All clinicians can collaborate on all consultations.

**What's Tested**:
- ✅ Any clinician can view any consultation
- ✅ Any clinician can create calls for any consultation
- ✅ Any clinician can document outcomes for any call
- ✅ Any clinician can send SMS for any consultation
- ✅ Clinicians can only modify their own slots
- ✅ Accountability fields track who performed each action

See [3-authorization.test.js](3-authorization.test.js) for complete authorization test suite.

## Cleanup Strategy

- **Global setup** ([globalSetup.ts](globalSetup.ts)): Resets entire DB, seeds admin
- **Between tests** (`afterEach`): Deletes test data (consultations, slots, SMS), keeps users
- **No manual cleanup needed**: Automatic via `cleanupTestData()`

## Helper Files

| File | Purpose |
|------|---------|
| [wasp.js](helpers/wasp.js) | Wasp operations (waspOp, login, setup) |
| [workflows.js](helpers/workflows.js) | Multi-step workflow helpers (acceptConsultationOnly, findRequestByPhone, etc.) |
| [fixtures.js](helpers/fixtures.js) | Test data generators (SMS, patients, slots) |
| [dates.js](helpers/dates.js) | Date utilities (getTomorrowDateString, etc.) |

## Known Coverage Gaps

- Multi-language SMS content
- Concurrent slot booking conflicts
- Bulk operations at scale (100+ slots/consultations)
- Database transaction rollback scenarios
