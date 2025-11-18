#!/bin/bash
# Reset database (local development only)
# Drops all tables, applies all migrations, runs seed

set -e

echo "Resetting database (drop tables, apply migrations, run seed)..."

# Ensure migrations are up to date (this will create .wasp/out/server/.env if needed)
wasp db migrate-dev || true

# Load Wasp's generated env file (source of truth for DATABASE_URL)
set -a
source .wasp/out/server/.env
set +a

# Load additional config from .env.server (API keys, etc.)
if [ -f .env.server ]; then
  set -a
  source .env.server
  set +a
fi

# Run Prisma reset
cd .wasp/build/server
npx prisma migrate reset --force --schema=../db/schema.prisma

echo "✅ Database reset complete"
