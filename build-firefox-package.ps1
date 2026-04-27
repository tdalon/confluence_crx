# Firefox Add-on Packaging Script (PowerShell)
# Creates a clean .zip file for uploading to Mozilla AMO

$ErrorActionPreference = "Stop"

# Configuration
$OutputDir = "releases"
$OutputFile = "confluence-firefox.zip"
$ManifestSource = "manifest.firefox.json"
$ManifestTarget = "manifest.json"

# Files and directories to EXCLUDE
$ExcludePatterns = @(
    # Development files
    "node_modules",
    ".git",
    ".gitignore",
    ".prettierrc",
    "package.json",
    "package-lock.json",
    
    # Build and configuration files
    "rollup.config.js",
    "build-firefox.js",
    "build-firefox-package.js",
    "build-firefox-package.ps1",
    "BUILD.md",
    "confluence_crx.code-workspace",
    
    # Chrome-specific files
    "manifest.chrome.json",
    
    # Documentation (optional)
    "README.md",
    "Changelog.md",
    "LICENSE",
    "docs",
    
    # Output directory
    "releases",
    
    # Firefox manifest source
    "manifest.firefox.json"
)

Write-Host "🦊 Creating Firefox Add-on Package..." -ForegroundColor Cyan
Write-Host ""

# Check if manifest.firefox.json exists
if (-not (Test-Path $ManifestSource)) {
    Write-Host "❌ Error: $ManifestSource not found." -ForegroundColor Red
    Write-Host "Please ensure manifest.firefox.json exists in the root directory." -ForegroundColor Red
    exit 1
}

# Create output directory
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

$OutputPath = Join-Path $OutputDir $OutputFile

# Remove existing zip if present
if (Test-Path $OutputPath) {
    Remove-Item $OutputPath -Force
    Write-Host "🗑️  Removed existing $OutputPath" -ForegroundColor Yellow
    Write-Host ""
}

# Create temporary directory for staging
$TempDir = Join-Path $env:TEMP "firefox-addon-build-$(Get-Date -Format 'yyyyMMddHHmmss')"
New-Item -ItemType Directory -Path $TempDir | Out-Null

Write-Host "📝 Copying files..." -ForegroundColor Cyan
Write-Host ""

# Function to check if path should be excluded
function Should-Exclude($path) {
    $relativePath = $path.Replace((Get-Location).Path, "").TrimStart("\", "/")
    
    foreach ($pattern in $ExcludePatterns) {
        if ($relativePath -like "*$pattern*" -or $relativePath -eq $pattern) {
            return $true
        }
    }
    return $false
}

# Copy files to temp directory
Get-ChildItem -Path . -Recurse | ForEach-Object {
    $relativePath = $_.FullName.Replace((Get-Location).Path, "").TrimStart("\")
    
    if (-not (Should-Exclude $_.FullName)) {
        $destPath = Join-Path $TempDir $relativePath
        
        if ($_.PSIsContainer) {
            # Create directory
            if (-not (Test-Path $destPath)) {
                New-Item -ItemType Directory -Path $destPath -Force | Out-Null
            }
        } else {
            # Copy file
            Write-Host "  ✓ Including: $relativePath" -ForegroundColor Green
            $destDir = Split-Path $destPath -Parent
            if (-not (Test-Path $destDir)) {
                New-Item -ItemType Directory -Path $destDir -Force | Out-Null
            }
            Copy-Item $_.FullName -Destination $destPath -Force
        }
    } else {
        Write-Host "  ⊗ Excluding: $relativePath" -ForegroundColor DarkGray
    }
}

# Copy manifest.firefox.json as manifest.json
Write-Host ""
Write-Host "📋 Renaming $ManifestSource to $ManifestTarget..." -ForegroundColor Cyan
Copy-Item $ManifestSource -Destination (Join-Path $TempDir $ManifestTarget) -Force

# Create zip file
Write-Host ""
Write-Host "📦 Creating ZIP archive..." -ForegroundColor Cyan

try {
    Compress-Archive -Path "$TempDir\*" -DestinationPath $OutputPath -CompressionLevel Optimal -Force
    
    $zipSize = (Get-Item $OutputPath).Length / 1MB
    Write-Host ""
    Write-Host "✅ Firefox package created successfully!" -ForegroundColor Green
    Write-Host "📦 File: $OutputPath" -ForegroundColor Cyan
    Write-Host "📊 Size: $([math]::Round($zipSize, 2)) MB" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "🚀 Ready to upload to Mozilla AMO: https://addons.mozilla.org/developers/" -ForegroundColor Yellow
} catch {
    Write-Host "❌ Error creating ZIP archive: $_" -ForegroundColor Red
    exit 1
} finally {
    # Clean up temp directory
    Remove-Item $TempDir -Recurse -Force
}
