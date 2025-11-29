#!/bin/bash
# Push cache updates to Google Drive using rclone

set -e

echo "Pushing cache to Google Drive..."
echo ""

# Check if rclone is installed
if ! command -v rclone &> /dev/null; then
    echo "❌ rclone is not installed"
    echo "Install it with: brew install rclone"
    exit 1
fi

# Check if tomdrive remote is configured
if ! rclone listremotes | grep -q "tomdrive:"; then
    echo "❌ rclone remote 'tomdrive' is not configured"
    exit 1
fi

# Check if cache directory exists
if [ ! -d "cache" ]; then
    echo "❌ cache directory not found"
    exit 1
fi

# Sync to Google Drive
echo "Syncing cache files..."
rclone sync cache/ tomdrive:news-sentiment-analyzer-cache --progress

echo ""
echo "✅ Cache pushed successfully!"
