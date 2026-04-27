# Firefox Add-on Packaging Guide

This guide explains how to create a clean Firefox add-on package for uploading to Mozilla AMO (addons.mozilla.org).

## Quick Start

### Option 1: Using Node.js Script (Recommended)

1. **Install dependencies** (first time only):
   ```bash
   npm install
   ```

2. **Build and package for Firefox**:
   ```bash
   npm run package-firefox
   ```

   This will:
   - Build the extension using rollup
   - Convert manifest to Firefox format
   - Create a clean `releases/confluence-firefox.zip` file

### Option 2: Using PowerShell Script (Windows)

```powershell
.\build-firefox-package.ps1
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
- `build-*.js` - build scripts
- `BUILD.md` - build documentation

### Chrome-Specific Files
- `manifest.chrome.json` - Chrome manifest (Firefox uses manifest.firefox.json)

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
- `manifest.json` (automatically created from `manifest.firefox.json`)

## Output

The packaged extension will be created at:
```
releases/confluence-firefox.zip
```

## Uploading to Mozilla AMO

1. Go to https://addons.mozilla.org/developers/
2. Sign in with your Mozilla account
3. Click "Submit a New Add-on"
4. Upload `releases/confluence-firefox.zip`
5. Follow the submission process

## Troubleshooting

### "archiver not found" error
Run `npm install` to install the required dependencies.

### Package too large
Check what's being included by reviewing the console output. You may need to add more exclusions to the scripts.

### Missing files in package
Review the `EXCLUDE_PATTERNS` in `build-firefox-package.js` and make sure you're not excluding necessary files.

## Manual Packaging (Alternative)

If you prefer to create the package manually:

1. Build the extension:
   ```bash
   npm run build-firefox
   ```

2. Create a zip file with these contents:
   - `manifest.json` (from `manifest.firefox.json`)
   - `dist/` directory
   - `images/` directory
   - All `.js`, `.css`, and `.html` files (except build scripts)

3. Exclude:
   - `node_modules/`
   - `package*.json`
   - Build scripts and configuration files
   - Chrome-specific files

## Customizing the Package

To customize what gets included/excluded, edit the `EXCLUDE_PATTERNS` array in:
- `build-firefox-package.js` (Node.js version)
- `build-firefox-package.ps1` (PowerShell version)

## Scripts Overview

- **build-firefox-package.js** - Node.js packaging script (requires archiver)
- **build-firefox-package.ps1** - PowerShell packaging script (no dependencies)
- Both scripts produce the same output

Choose the one that best fits your workflow!
