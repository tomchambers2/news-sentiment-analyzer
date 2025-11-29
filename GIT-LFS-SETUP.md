# Git LFS Setup

This repository has Git LFS configured but **cache files are excluded** from version control.

## Cache Directory

The `cache/` directory (3.6 GB) is **not committed** to Git:

- Excluded via `.gitignore`
- Stored on Google Drive and synced via rclone
- See [CACHE-SETUP.md](CACHE-SETUP.md) for setup instructions

Git LFS was considered but we use rclone + Google Drive instead (free, no storage limits).

## Repository Size

The Git repository is only **~688 KB** without cache files, making it:

- ✅ Free to host on GitHub
- ✅ Fast to clone
- ✅ Easy to backup

## Working with This Repository

### Cloning

```bash
git clone https://github.com/tomchambers2/news-sentiment-analyzer.git
cd news-sentiment-analyzer
npm install
# The cache directory will be generated as you use the application
```

### Installing Git LFS (Optional)

If you plan to track large files in the future:

```bash
# macOS
brew install git-lfs

# Initialize in the repo
git lfs install
```

## Important Notes

- The `cache/` directory is in `.gitignore` - do not remove this!
- Cache files are regenerable and don't need to be shared
- If you need to share cached data, use other methods (cloud storage, database backups, etc.)
