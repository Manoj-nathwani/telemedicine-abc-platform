#!/bin/bash

source "$(dirname "$0")/deploy-common.sh"

echo "Deploying database reset job to Google Cloud Run..."

echo "Building Wasp app..."
wasp build

load_env
docker_login

JOB_NAME="telemedicineabc-drc-reset-db"
IMAGE_URL=$(build_and_push_image "$JOB_NAME" ".wasp/build" "db-reset")

echo "Deploying Cloud Run job..."
gcloud run jobs deploy $JOB_NAME \
  --image $IMAGE_URL \
  --region $REGION \
  --project $PROJECT_ID \
  --memory 512Mi \
  --cpu 1 \
  --max-retries 0 \
  --task-timeout 10m \
  --set-cloudsql-instances $CLOUDSQL_DB \
  --set-secrets "DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest" \
  --set-env-vars "\
    WASP_DB_SEED_NAME=seedConfig,\
    ADMIN_EMAIL=$ADMIN_EMAIL,\
    MAILGUN_API_KEY=$MAILGUN_API_KEY,\
    MAILGUN_DOMAIN=$MAILGUN_DOMAIN,\
    MAILGUN_API_URL=$MAILGUN_API_URL,\
    SMS_API_KEY=$SMS_API_KEY,\
    WASP_WEB_CLIENT_URL=$WASP_WEB_CLIENT_URL,\
    WASP_SERVER_URL=$WASP_SERVER_URL" \
  --quiet

echo "✅ Reset job deployed: $IMAGE_URL"
echo ""
echo "➡️ Execute: gcloud run jobs execute $JOB_NAME --region=$REGION --project=$PROJECT_ID"
echo "➡️ Delete: gcloud run jobs delete $JOB_NAME --region=$REGION --project=$PROJECT_ID"
