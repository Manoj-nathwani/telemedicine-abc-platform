#!/bin/bash

source "$(dirname "$0")/deploy-common.sh"

echo "Deploying server to Google Cloud Run..."

echo "Building Wasp app..."
wasp build

load_env
ensure_artifact_registry
docker_login

CLOUDRUN_SERVICE="telemedicineabc-drc-server"
IMAGE_URL=$(build_and_push_image "$CLOUDRUN_SERVICE" ".wasp/build" "server-production")

echo "Deploying Cloud Run service..."
gcloud run deploy $CLOUDRUN_SERVICE \
  --image $IMAGE_URL \
  --region $REGION \
  --project $PROJECT_ID \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 1 \
  --concurrency 80 \
  --add-cloudsql-instances $CLOUDSQL_DB \
  --set-secrets "DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest" \
  --set-env-vars "\
    MAILGUN_API_KEY=$MAILGUN_API_KEY,\
    MAILGUN_DOMAIN=$MAILGUN_DOMAIN,\
    MAILGUN_API_URL=$MAILGUN_API_URL,\
    SMS_API_KEY=$SMS_API_KEY,\
    WASP_WEB_CLIENT_URL=$WASP_WEB_CLIENT_URL,\
    WASP_SERVER_URL=$WASP_SERVER_URL" \
  --quiet

echo "✅ Server deployed: $IMAGE_URL"