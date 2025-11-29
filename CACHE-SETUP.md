# Cache Setup with rclone + Google Drive

The 3.6 GB cache directory is stored on Google Drive and can be synced using rclone. This acts like Git LFS but uses Google Drive as the storage backend.

## For New Users (First Time Setup)

### 1. Install rclone

```bash
brew install rclone
```

### 2. Configure Google Drive

```bash
rclone config
```

Follow the prompts:

- Choose `n` for new remote
- Name it: `tomdrive`
- Storage type: `22` (Google Drive)
- Leave client_id and client_secret blank (uses defaults)
- Scope: `3` (drive.file - rclone files only)
- Leave service_account_file blank
- Use web browser: `y`
- Authenticate in your browser
- Not a shared drive: `n`
- Confirm: `y`

### 3. Pull the cache

```bash
./scripts/pull-cache.sh
```

This downloads ~3.6 GB from Google Drive to your local `cache/` directory.

## For Contributors (Updating Cache)

If you've added/updated cache data and want to push it:

```bash
./scripts/push-cache.sh
```

This syncs your local `cache/` directory to Google Drive.

## How It Works

- **Cache location**: `tomdrive:news-sentiment-analyzer-cache` on Google Drive
- **Local cache**: `cache/` directory (gitignored)
- **Scripts**:
  - `scripts/pull-cache.sh` - Download cache from Google Drive
  - `scripts/push-cache.sh` - Upload cache to Google Drive

## Important Notes

### Scope: drive.file

The rclone config uses `drive.file` scope, which means:

- ✅ rclone can only access files it created
- ✅ Your other Google Drive files are not visible to rclone
- ✅ More secure than full Drive access

### Storage Limits

- Google Drive free tier: 15 GB total
- Current cache size: 3.6 GB
- Make sure you have enough space

### Sync vs Copy

- `pull-cache.sh` uses `rclone sync` - makes local match remote exactly
- `push-cache.sh` uses `rclone sync` - makes remote match local exactly
- Be careful: sync deletes files that don't exist on the source

## Manual Commands

### Check cache size on Google Drive

```bash
rclone size tomdrive:news-sentiment-analyzer-cache
```

### List cache files

```bash
rclone ls tomdrive:news-sentiment-analyzer-cache
```

### Download specific files

```bash
rclone copy tomdrive:news-sentiment-analyzer-cache/cache.db cache/
```

### Two-way sync (safer for collaboration)

```bash
# Instead of sync, use copy to avoid deletions
rclone copy tomdrive:news-sentiment-analyzer-cache cache/ --progress
```

## Troubleshooting

### "tomdrive remote not found"

Run `rclone config` and create the `tomdrive` remote following the steps above.

### "Permission denied"

Re-authenticate:

```bash
rclone config reconnect tomdrive:
```

### "Quota exceeded"

You'll need to free up space in your Google Drive or upgrade to a paid plan.

## Alternative: Using Your Own Remote Name

If you prefer a different remote name than `tomdrive`:

1. Configure your remote: `rclone config`
2. Edit the scripts to use your remote name
3. Or use rclone directly:
   ```bash
   rclone sync yourremote:news-sentiment-analyzer-cache cache/
   ```
