# Batch Studio - Tauri Setup Script
# Downloads fonts and copies resources for the Tauri build.

Write-Host "=== Batch Studio - Tauri Setup ===" -ForegroundColor Cyan

# --- 1. Download fonts ---
Write-Host "`n[1/4] Downloading fonts..." -ForegroundColor Yellow
$fontsDir = "public\fonts"
if (!(Test-Path $fontsDir)) { New-Item -ItemType Directory -Path $fontsDir -Force | Out-Null }

$fonts = @{
    "Inter-Regular.woff2"         = "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiA.woff2"
    "Inter-Medium.woff2"          = "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fAZ9hiA.woff2"
    "Inter-SemiBold.woff2"        = "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYAZ9hiA.woff2"
    "Inter-Bold.woff2"            = "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hiA.woff2"
    "JetBrainsMono-Regular.woff2" = "https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxTOlOTk6OThhvA.woff2"
    "JetBrainsMono-Medium.woff2"  = "https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxTOlOTk6OThhvA.woff2"
}

foreach ($font in $fonts.GetEnumerator()) {
    $dest = Join-Path $fontsDir $font.Key
    if (!(Test-Path $dest)) {
        Write-Host "  Downloading $($font.Key)..."
        try {
            Invoke-WebRequest -Uri $font.Value -OutFile $dest -UseBasicParsing
        } catch {
            Write-Host "  WARNING: Failed to download $($font.Key). You can download it manually." -ForegroundColor Red
        }
    } else {
        Write-Host "  $($font.Key) already exists, skipping."
    }
}

# --- 2. Copy resources for Tauri bundling ---
Write-Host "`n[2/4] Copying resources for Tauri bundle..." -ForegroundColor Yellow
$resourceBase = "src-tauri\resources"

# Compliance icons
$compSrc = "public\compliance"
$compDst = "$resourceBase\compliance"
if (Test-Path $compSrc) {
    Copy-Item "$compSrc\*" $compDst -Force -Recurse
    Write-Host "  Copied compliance icons."
} else {
    Write-Host "  No compliance directory found in public/." -ForegroundColor DarkYellow
}

# Safezone images
$safeSrc = "public\safezones"
$safeDst = "$resourceBase\safezones"
if (Test-Path $safeSrc) {
    Copy-Item "$safeSrc\*" $safeDst -Force -Recurse
    Write-Host "  Copied safezone images."
} else {
    Write-Host "  No safezones directory found in public/." -ForegroundColor DarkYellow
}

# Config
$configSrc = "public\config.json"
$configDst = "$resourceBase\config.json"
if (Test-Path $configSrc) {
    Copy-Item $configSrc $configDst -Force
    Write-Host "  Copied config.json."
}

# Fonts
$fontsDst = "$resourceBase\fonts"
if (!(Test-Path $fontsDst)) { New-Item -ItemType Directory -Path $fontsDst -Force | Out-Null }
if (Test-Path $fontsDir) {
    Copy-Item "$fontsDir\*.woff2" $fontsDst -Force
    Write-Host "  Copied font files."
}

# --- 3. Check FFmpeg ---
Write-Host "`n[3/4] Checking FFmpeg sidecar..." -ForegroundColor Yellow
$ffmpegPath = "src-tauri\binaries\ffmpeg-x86_64-pc-windows-msvc.exe"
if (Test-Path $ffmpegPath) {
    Write-Host "  FFmpeg sidecar found." -ForegroundColor Green
} else {
    if (!(Test-Path "src-tauri\binaries")) { New-Item -ItemType Directory -Path "src-tauri\binaries" -Force | Out-Null }
    Write-Host "  FFmpeg sidecar NOT found!" -ForegroundColor Red
    Write-Host "  Please download FFmpeg essentials from: https://www.gyan.dev/ffmpeg/builds/"
    Write-Host "  Extract ffmpeg.exe and copy it to:"
    Write-Host "    src-tauri\binaries\ffmpeg-x86_64-pc-windows-msvc.exe" -ForegroundColor White
}

# --- 4. Install dependencies ---
Write-Host "`n[4/4] Next steps:" -ForegroundColor Yellow
Write-Host "  1. Run: npm install"
Write-Host "  2. Run: npm run tauri:dev   (for development)"
Write-Host "  3. Run: npm run tauri:build (for production .exe)"
Write-Host ""
Write-Host "=== Setup complete ===" -ForegroundColor Green
