#!/bin/bash

# VAPID Key Generation - Industry Standard
echo "🔑 Generating VAPID Keys"
echo "========================"

npx web-push generate-vapid-keys

echo ""
echo "📖 Copy the keys above to:"
echo "- secret/.env (local development)"
echo "- Google Cloud Secret Manager (staging/production)"
