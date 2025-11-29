# Google Drive Cache Setup

The `cache/` directory (3.6 GB) is stored on Google Drive and symlinked to this repository.

## Current Setup

```
cache/ → ~/Google Drive/news-sentiment-analyzer-cache
```

The cache is:

- ✅ Backed up to Google Drive
- ✅ Synced across your devices
- ✅ Not committed to Git (via `.gitignore`)
- ✅ Works transparently with the application

## How It Works

The `cache` directory in this repo is a **symbolic link** pointing to:

```
~/Google Drive/news-sentiment-analyzer-cache
```

Your application reads/writes to `cache/` normally, but the data is actually stored on Google Drive.

## Setting Up on Another Machine

If you clone this repo on another machine:

1. **Install Google Drive** and let it sync

2. **Verify the cache exists** on Google Drive:

   ```bash
   ls -lah ~/Google\ Drive/news-sentiment-analyzer-cache
   ```

3. **Create the symlink** in your project:

   ```bash
   cd /path/to/news-sentiment-analyzer
   ln -s "$HOME/Google Drive/news-sentiment-analyzer-cache" cache
   ```

4. **Verify it works**:
   ```bash
   ls cache/  # Should show your cache files
   ```

## Starting Fresh (No Existing Cache)

If you're on a new machine without the cached data:

1. **Create the Google Drive directory**:

   ```bash
   mkdir -p "$HOME/Google Drive/news-sentiment-analyzer-cache"
   ```

2. **Create the symlink**:

   ```bash
   cd /path/to/news-sentiment-analyzer
   ln -s "$HOME/Google Drive/news-sentiment-analyzer-cache" cache
   ```

3. **Run your application** - it will generate new cache files that sync to Google Drive

## Important Notes

- **Don't commit the symlink**: The `.gitignore` already excludes `cache/`
- **Wait for sync**: Large cache operations may take time to sync to Google Drive
- **Storage limits**: Google Drive free tier has 15 GB - your cache uses 3.6 GB
- **Offline access**: Configure Google Drive to keep files offline if needed

## Troubleshooting

### Symlink broken?

```bash
# Remove broken symlink
rm cache

# Recreate it
ln -s "$HOME/Google Drive/news-sentiment-analyzer-cache" cache
```

### Want to move back to local storage?

```bash
# Copy data from Google Drive
cp -r "$HOME/Google Drive/news-sentiment-analyzer-cache" cache-local

# Remove symlink
rm cache

# Rename to cache
mv cache-local cache
```

### Google Drive path changed?

Update the symlink:

```bash
rm cache
ln -s "/path/to/new/google-drive/location/news-sentiment-analyzer-cache" cache
```
