#!/usr/bin/env node

/**
 * Chrome Extension Packaging Script
 * Creates a clean .zip file for uploading to Chrome Web Store
 * Excludes Firefox-specific files and development artifacts
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Configuration
const OUTPUT_DIR = 'releases';
const OUTPUT_FILENAME = 'confluence-chrome.zip';
const MANIFEST_SOURCE = 'manifest.chrome.json';
const MANIFEST_TARGET = 'manifest.json';

// Files and directories to EXCLUDE from the package
const EXCLUDE_PATTERNS = [
  // Development files
  'node_modules',
  '.git',
  '.gitignore',
  '.prettierrc',
  'package.json',
  'package-lock.json',
  
  // Build and configuration files
  'rollup.config.js',
  'build-firefox.js',
  'build-firefox-package.js',
  'build-firefox-package.ps1',
  'build-chrome-package.js',
  'build-chrome-package.ps1',
  'BUILD.md',
  'confluence_crx.code-workspace',
  
  // Firefox-specific files
  'manifest.firefox.json',
  'FIREFOX_PACKAGING.md',
  
  // Documentation (optional - remove from exclude if you want to include)
  'README.md',
  'Changelog.md',
  'LICENSE',
  'docs',
  
  // Output directory
  'releases',
  
  // Chrome manifest source (we'll copy it as manifest.json)
  'manifest.chrome.json',
];

/**
 * Check if a file path should be excluded
 */
function shouldExclude(filePath) {
  const relativePath = path.relative(process.cwd(), filePath);
  const pathParts = relativePath.split(path.sep);
  
  return EXCLUDE_PATTERNS.some(pattern => {
    // Check if any part of the path matches the exclude pattern
    return pathParts.some(part => part === pattern) || relativePath === pattern;
  });
}

/**
 * Recursively add files to the archive
 */
function addFilesToArchive(archive, dir, baseDir = '') {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const relativePath = path.join(baseDir, file);
    const stat = fs.statSync(filePath);
    
    // Skip if should be excluded
    if (shouldExclude(filePath)) {
      console.log(`  ⊗ Excluding: ${relativePath}`);
      return;
    }
    
    if (stat.isDirectory()) {
      // Recursively add directory contents
      addFilesToArchive(archive, filePath, relativePath);
    } else {
      // Add file to archive
      console.log(`  ✓ Including: ${relativePath}`);
      
      // Special handling for manifest.chrome.json -> manifest.json
      if (file === MANIFEST_SOURCE) {
        archive.file(filePath, { name: MANIFEST_TARGET });
      } else {
        archive.file(filePath, { name: relativePath });
      }
    }
  });
}

/**
 * Create the Chrome package
 */
async function createChromePackage() {
  console.log('🌐 Creating Chrome Extension Package...\n');
  
  // Check if archiver is installed
  try {
    require.resolve('archiver');
  } catch (e) {
    console.error('❌ Error: archiver package not found.');
    console.error('Please install it with: npm install --save-dev archiver');
    process.exit(1);
  }
  
  // Check if manifest.chrome.json exists
  if (!fs.existsSync(MANIFEST_SOURCE)) {
    console.error(`❌ Error: ${MANIFEST_SOURCE} not found.`);
    console.error('Please ensure manifest.chrome.json exists in the root directory.');
    process.exit(1);
  }
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const outputPath = path.join(OUTPUT_DIR, OUTPUT_FILENAME);
  
  // Remove existing zip if present
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
    console.log(`🗑️  Removed existing ${outputPath}\n`);
  }
  
  // Create write stream
  const output = fs.createWriteStream(outputPath);
  const archive = archiver('zip', {
    zlib: { level: 9 } // Maximum compression
  });
  
  // Setup event handlers
  output.on('close', () => {
    const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
    console.log(`\n✅ Chrome extension package created successfully!`);
    console.log(`📦 File: ${outputPath}`);
    console.log(`📊 Size: ${sizeInMB} MB`);
    console.log(`\n🚀 Ready to upload to Chrome Web Store: https://chrome.google.com/webstore/devconsole`);
  });
  
  archive.on('error', (err) => {
    console.error('❌ Error creating archive:', err);
    throw err;
  });
  
  archive.on('warning', (err) => {
    if (err.code === 'ENOENT') {
      console.warn('⚠️  Warning:', err);
    } else {
      throw err;
    }
  });
  
  // Pipe archive to output file
  archive.pipe(output);
  
  console.log('📝 Adding files to archive:\n');
  
  // Add files to archive
  addFilesToArchive(archive, process.cwd());
  
  // Finalize the archive
  await archive.finalize();
}

// Run the script
createChromePackage().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
