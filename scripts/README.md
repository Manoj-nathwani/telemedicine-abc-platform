# Scripts

## generate-audit-types.js

Auto-generates TypeScript type declarations for audit logging.

**When to run:**
- After adding new models to `schema.prisma`
- Automatically runs after `npm run db:migrate`

**Manual run:**
```bash
npm run generate:audit-types
```

**What it does:**
1. Reads `schema.prisma`
2. Extracts all model names
3. Generates TypeScript interface declarations for `__auditUserId` field
4. Writes to `src/types/prisma-audit.d.ts`

This enables type-safe audit logging without `as any` type casts.
