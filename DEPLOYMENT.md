# Deployment Guide

Simple deployment using local scripts to Google Cloud Run (server) and Cloudflare Pages (client).

## Quick Deploy

```bash
# Deploy both server and client
npm run deploy

# Or deploy individually
npm run deploy:server
npm run deploy:client
```

## Prerequisites

1. **Google Cloud CLI** authenticated: `gcloud auth login`
2. **Docker Desktop** installed and running (for building images)
3. **Node.js v20** (matches Wasp's Dockerfile - avoid v21 which has compatibility issues)
4. **Cloudflare Wrangler CLI** configured: `npm install -g wrangler && wrangler login` (for client deployment)

## Environment Setup

```bash
# Create your environment files
# .env.server contains all configuration for local development
# .env.server.production contains production overrides (DATABASE_URL, WASP_WEB_CLIENT_URL, WASP_SERVER_URL)
# .env.client.production contains production API URL

# For local development, .env.client is minimal (Wasp handles API URL automatically)
```

## Initial Setup

### 1. Google Cloud Setup
```bash
export PROJECT_ID="your-project-id"

# Enable required services
gcloud services enable run.googleapis.com cloudbuild.googleapis.com

# Create service account (if using GitHub Actions later)
gcloud iam service-accounts create github-actions --project=$PROJECT_ID
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.editor"
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.viewer"
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"
```

### 2. Cloudflare Setup
1. Create new project in Cloudflare Pages
2. Get API token from Cloudflare dashboard
3. Note your account ID

## Deployment Flow

**Server**: 
1. `wasp build` → Creates production app
2. `docker build --platform linux/amd64` → Builds Docker image locally
3. `docker push` → Pushes to Artifact Registry  
4. `gcloud run deploy` → Deploys to Cloud Run with Cloud SQL connection

**Client**:
1. `wasp build` → Creates React app
2. `npm run build` → Builds static files
3. `wrangler pages deploy` → Deploys to Cloudflare

## Troubleshooting

**Docker build fails**: Check that you're authenticated with `gcloud auth login` and Docker Desktop is running

**esbuild version mismatch**: If you see "Expected '0.21.5' but got '0.X.X'" error, ensure esbuild is explicitly listed in package.json dependencies

**Architecture mismatch on Mac**: Deploy script uses `--platform linux/amd64` to ensure compatibility with Cloud Run's x86_64 architecture

**Client build fails**: Wasp generates malformed package.json - the deploy script fixes this automatically

**Cloud Run deployment fails**: Check that all environment variables are set in .env files and Cloud SQL instance is properly configured

**Port binding errors**: Cloud Run automatically provides PORT environment variable - don't specify custom ports

**Database connection fails**: Ensure Cloud SQL instance is added to Cloud Run service with `--add-cloudsql-instances` flag

**Domain not working**: Verify DNS is pointing to your Cloud Run service and custom domain is configured in Cloud Run