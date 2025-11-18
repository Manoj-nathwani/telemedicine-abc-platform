#!/bin/bash
set -e

echo "Deploying client to Cloudflare Pages..."

CLOUDFLARE_PROJECT_NAME="telemedicineabc-drc"

if [ ! -f .env.client.production ]; then
    echo "Error: .env.client.production file not found"
    exit 1
fi
source .env.client.production

echo "Building Wasp project..."
wasp build

cd .wasp/build/web-app

cat > .env.production << EOF
REACT_APP_REDIRECT_URL=$REACT_APP_REDIRECT_URL
REACT_APP_API_URL=$REACT_APP_API_URL
EOF

npm install
NODE_ENV=production npm run build

echo "Deploying to Cloudflare Pages..."
BRANCH=$(git branch --show-current)

npx wrangler pages deploy build \
  --project-name="$CLOUDFLARE_PROJECT_NAME" \
  --branch="$BRANCH"

echo "✅ Client deployed: $CLOUDFLARE_PROJECT_NAME ($BRANCH)"

cd ../../../