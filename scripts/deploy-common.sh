#!/bin/bash
# Common deployment configuration and functions for Google Cloud Run

# Exit on any error
set -e

# Load deployment configuration
load_deploy_config() {
  if [ ! -f .env.deploy ]; then
    echo "Error: .env.deploy file not found"
    exit 1
  fi
  source .env.deploy

  # Validate required variables
  : "${PROJECT_ID:?PROJECT_ID is required}"
  : "${REGION:?REGION is required}"
  : "${ARTIFACT_REGISTRY:?ARTIFACT_REGISTRY is required}"
  : "${CLOUDSQL_DB:?CLOUDSQL_DB is required}"

  export PROJECT_ID
  export REGION
  export ARTIFACT_REGISTRY
  export CLOUDSQL_DB
}

# Load production environment variables
load_env() {
  if [ ! -f .env.server.production ]; then
    echo "Error: .env.server.production file not found"
    exit 1
  fi
  source .env.server.production
}

# Load deployment config automatically when script is sourced
load_deploy_config

# Create Artifact Registry repository if it doesn't exist
ensure_artifact_registry() {
  gcloud artifacts repositories create $ARTIFACT_REGISTRY \
    --repository-format=docker \
    --location=$REGION \
    --project=$PROJECT_ID \
    --quiet 2>/dev/null || true
}

# Authenticate with Docker registry
docker_login() {
  echo "Authenticating with Docker registry..."
  echo $(gcloud auth print-access-token) | docker login -u oauth2accesstoken --password-stdin $REGION-docker.pkg.dev
}

# Build and push Docker image
# Args: $1=image_name, $2=dockerfile_path (optional), $3=target_stage (optional)
build_and_push_image() {
  local image_name=$1
  local dockerfile_path=${2:-.wasp/build}
  local target_stage=$3

  local image_url="$REGION-docker.pkg.dev/$PROJECT_ID/$ARTIFACT_REGISTRY/$image_name:latest"

  echo "Building and pushing Docker image: $image_url" >&2

  local build_args="--platform linux/amd64 -t $image_url"

  if [ -n "$target_stage" ]; then
    build_args="$build_args --target $target_stage"
  fi

  docker build $build_args $dockerfile_path >&2
  docker push $image_url >&2

  echo "$image_url"
}
