#!/bin/bash
# Pull cache from Google Drive using rclone

set -e

echo "Pulling cache from Google Drive..."
echo "This will download ~3.6 GB of data"
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
    echo ""
    echo "Configure it with:"
    echo "  rclone config"
    echo ""
    echo "Follow the prompts to add a Google Drive remote named 'tomdrive'"
    exit 1
fi

# Create cache directory if it doesn't exist
mkdir -p cache

# Sync from Google Drive
echo "Syncing cache files..."
rclone sync tomdrive:news-sentiment-analyzer-cache cache/ --progress

echo ""
echo "✅ Cache synced successfully!"
