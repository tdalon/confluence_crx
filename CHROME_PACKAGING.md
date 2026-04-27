# Chrome Extension Packaging Guide

This guide explains how to create a clean Chrome extension package for uploading to Chrome Web Store.

## Quick Start

### Option 1: Using Node.js Script (Recommended)

1. **Install dependencies** (if not already installed):
   ```bash
   npm install
   ```

2. **Build and package for Chrome**:
   ```bash
   npm run package-chrome
   ```

   This will:
   - Build the extension using rollup
   - Restore Chrome manifest
   - Create a clean `releases/confluence-chrome.zip` file

### Option 2: Using PowerShell Script (Windows)

```powershell
.\build-chrome-package.ps1
```

This is a standalone script that doesn't require npm dependencies.

## What Gets Excluded

The packaging scripts automatically exclude:

### Development Files
- `node_modules/` - npm dependencies
- `package.json`, `package-lock.json` - npm configuration
- `.git/`, `.gitignore` - version control
- `.prettierrc` - code formatting config
- `*.code-workspace` - VS Code workspace files

### Build Configuration Files
- `rollup.config.js` - bundler config
- `build-*.js`, `build-*.ps1` - build scripts
- `BUILD.md` - build documentation

### Firefox-Specific Files
- `manifest.firefox.json` - Firefox manifest (Chrome uses manifest.chrome.json)
- `FIREFOX_PACKAGING.md` - Firefox documentation

### Documentation (Optional)
- `README.md`
- `Changelog.md`
- `LICENSE`
- `docs/` directory

## What Gets Included

- `dist/` - All bundled JavaScript files
- `images/` - Extension icons and images
- All `.js` files in the root (content scripts, etc.)
- All `.css` files
- All `.html` files
- `manifest.json` (automatically created from `manifest.chrome.json`)

## Output

The packaged extension will be created at:
```
releases/confluence-chrome.zip
```

## Uploading to Chrome Web Store

1. Go to https://chrome.google.com/webstore/devconsole
2. Sign in with your Google account
3. Click "New Item" or update an existing extension
4. Upload `releases/confluence-chrome.zip`
5. Fill in the required store listing details
6. Submit for review

## Chrome Web Store Requirements

Make sure your package meets Chrome's requirements:
- Maximum size: 20 MB (your package should be well under this)
- Valid `manifest.json` with all required fields
- All permissions properly declared
- Icons in required sizes (16x16, 48x48, 128x128)

## Troubleshooting

### "archiver not found" error
Run `npm install` to install the required dependencies.

### Package too large
Check what's being included by reviewing the console output. You may need to add more exclusions to the scripts.

### Missing files in package
Review the `EXCLUDE_PATTERNS` in `build-chrome-package.js` and make sure you're not excluding necessary files.

### Chrome rejects the package
- Verify `manifest.chrome.json` is valid
- Check that all referenced files exist in the package
- Ensure icons are the correct sizes
- Review Chrome's extension policies

## Manual Packaging (Alternative)

If you prefer to create the package manually:

1. Build the extension:
   ```bash
   npm run build
   npm run restore-chrome
   ```

2. Create a zip file with these contents:
   - `manifest.json` (from `manifest.chrome.json`)
   - `dist/` directory
   - `images/` directory
   - All `.js`, `.css`, and `.html` files (except build scripts)

3. Exclude:
   - `node_modules/`
   - `package*.json`
   - Build scripts and configuration files
   - Firefox-specific files

## Testing Before Upload

Before uploading to Chrome Web Store:

1. Extract the zip file to a test directory
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the test directory
6. Test all functionality

## Customizing the Package

To customize what gets included/excluded, edit the `EXCLUDE_PATTERNS` array in:
- `build-chrome-package.js` (Node.js version)
- `build-chrome-package.ps1` (PowerShell version)

## Scripts Overview

- **build-chrome-package.js** - Node.js packaging script (requires archiver)
- **build-chrome-package.ps1** - PowerShell packaging script (no dependencies)
- Both scripts produce the same output

## Differences from Firefox Package

Chrome packaging:
- Uses `manifest.chrome.json` instead of `manifest.firefox.json`
- No Firefox-specific transformations needed
- Different Web Store submission process

Choose the packaging method that best fits your workflow!

## Related Commands

```bash
# Build only (no packaging)
npm run build

# Restore Chrome manifest after Firefox build
npm run restore-chrome

# Package for Firefox instead
npm run package-firefox
```
