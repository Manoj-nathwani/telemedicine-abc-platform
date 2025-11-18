#!/bin/bash

clear
set -e

echo "Stopping any existing Wasp database containers..."
docker stop $(docker ps -q --filter "name=wasp") 2>/dev/null || true
docker rm $(docker ps -aq --filter "name=wasp") 2>/dev/null || true

echo "Starting Wasp database..."
wasp start db