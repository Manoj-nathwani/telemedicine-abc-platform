#!/bin/bash
# Reset database (local development only)
# Drops all tables, applies all migrations, runs seed

set -e

echo "Resetting database (drop tables, apply migrations, run seed)..."

# Load and export environment variables
set -a
source .env.server
DATABASE_URL="$WASP_DEV_DB_URL"

# Run Prisma reset
cd .wasp/build/server
npx prisma migrate reset --force --schema=../db/schema.prisma

echo "✅ Database reset complete"
