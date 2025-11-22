#!/bin/bash
set -e

echo "Deploying Convex and generating types..."

# Run convex deploy and export the NEXT_PUBLIC_CONVEX_URL for the build
# The convex deploy command will set NEXT_PUBLIC_CONVEX_URL, we capture it by running a script
eval $(convex deploy --cmd 'echo "export NEXT_PUBLIC_CONVEX_URL=$NEXT_PUBLIC_CONVEX_URL"' --preview-name preview)

echo "NEXT_PUBLIC_CONVEX_URL is set to: $NEXT_PUBLIC_CONVEX_URL"

echo "Building Next.js app..."
next build
