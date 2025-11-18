# Custom Wasp Dockerfile additions
# This file is appended to Wasp's default Dockerfile

# Database reset job stage
# Used by Cloud Run job to reset production database
FROM base AS db-reset

ENV NODE_ENV=production
ENV WASP_DB_SEED_NAME=seedConfig

WORKDIR /app

# Copy pre-built artifacts from server-builder stage
COPY --from=server-builder /app/node_modules ./node_modules
COPY --from=server-builder /app/.wasp/build/server/node_modules .wasp/build/server/node_modules
COPY --from=server-builder /app/.wasp/build/server/bundle .wasp/build/server/bundle
COPY --from=server-builder /app/.wasp/build/server/package*.json .wasp/build/server/
COPY db/ .wasp/build/db/

WORKDIR /app/.wasp/build/server

# Reset database: drop all tables, apply migrations, run seed
# Note: Skip Prisma's automatic seed (tries to rebuild) and use pre-built bundle
ENTRYPOINT ["sh", "-c", "npx prisma migrate reset --force --skip-seed --schema=../db/schema.prisma && node --enable-source-maps -r dotenv/config bundle/dbSeed.js"]
