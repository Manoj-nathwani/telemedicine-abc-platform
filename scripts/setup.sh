#!/bin/bash

clear
set -e

echo "Cleaning cache..."
wasp clean

echo "Setting up TypeScript..."
wasp ts-setup

echo "Building project..."
wasp build

./scripts/reset-db.sh

echo "✅ Setup complete"

