#!/bin/bash
set -e

# Run the original build
npm run build

# Create the client directory that Render expects
mkdir -p dist/client
cp -r dist/public/* dist/client/
echo "Build complete - created dist/client directory for Render deployment"