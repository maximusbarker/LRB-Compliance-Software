<# 
LRB Jun30 Build - Full Installer (no videos required)

This script:
  - Prompts once for confirmation
  - Installs required prerequisites (Node.js LTS, Git) via winget if missing
  - Copies this project into a new folder: "LRB Jun30 Build" (excluding videos)
  - Installs server dependencies (npm install)
  - Creates desktop shortcuts to start the server and open the UI

Run:
  powershell -ExecutionPolicy Bypass -File .\installer\Install-LRB.ps1
#>

[CmdletBinding()]
param(
  [string]$InstallRoot = "$env:USERPROFILE\LRB Jun30 Build",
  [switch]$NoShortcuts
)

$ErrorActionPreference = "Stop"

function Write-Info([string]$msg) { Write-Host "[LRB] $msg" -ForegroundColor Cyan }
function Write-Warn([string]$msg) { Write-Host "[LRB] $msg" -ForegroundColor Yellow }
function Write-Err([string]$msg)  { Write-Host "[LRB] $msg" -ForegroundColor Red }

function Test-Command([string]$name) {
  $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

function Assert-Winget() {
  if (Test-Command "winget") { return }
  throw "winget is not available. Install 'App Installer' from Microsoft Store, then re-run."
}

function Assert-Tool([string]$toolName, [string]$wingetId) {
  if (Test-Command $toolName) {
    Write-Info "$toolName already installed."
    return
  }

  Assert-Winget
  Write-Info "Installing $toolName via winget ($wingetId)..."
  winget install --id $wingetId --silent --accept-package-agreements --accept-source-agreements | Out-Host

  if (-not (Test-Command $toolName)) {
    throw "$toolName install did not complete successfully. Please reboot or re-run installer."
  }
}

function Install-PortableNode([string]$installDir) {
  # Keep this pinned for reproducible installs (Node 20 LTS)
  $nodeVersion = "20.11.1"
  $arch = "x64"
  $baseName = "node-v$nodeVersion-win-$arch"
  $zipName = "$baseName.zip"
  $url = "https://nodejs.org/dist/v$nodeVersion/$zipName"

  $toolsDir = Join-Path $installDir "tools"
  $nodeRoot = Join-Path $toolsDir "node"
  $tmpDir = Join-Path $env:TEMP ("lrb-node-" + [Guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Force $tmpDir | Out-Null
  New-Item -ItemType Directory -Force $toolsDir | Out-Null

  try {
    Write-Info "Downloading portable Node.js LTS (no admin) ..."
    $zipPath = Join-Path $tmpDir $zipName
    Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing

    Write-Info "Extracting Node to $nodeRoot ..."
    if (Test-Path $nodeRoot) { Remove-Item -Recurse -Force $nodeRoot }
    New-Item -ItemType Directory -Force $nodeRoot | Out-Null
    Expand-Archive -LiteralPath $zipPath -DestinationPath $tmpDir -Force

    $extracted = Join-Path $tmpDir $baseName
    if (-not (Test-Path $extracted)) {
      throw "Unexpected Node archive layout. Missing: $extracted"
    }
    Copy-Item -LiteralPath (Join-Path $extracted "*") -Destination $nodeRoot -Recurse -Force

    $npmCmd = Join-Path $nodeRoot "npm.cmd"
    $nodeExe = Join-Path $nodeRoot "node.exe"
    if (-not (Test-Path $nodeExe)) { throw "Portable node.exe not found at $nodeExe" }
    if (-not (Test-Path $npmCmd)) { throw "Portable npm.cmd not found at $npmCmd" }

    Write-Info "Portable Node installed."
    return $nodeRoot
  } finally {
    try { Remove-Item -Recurse -Force $tmpDir } catch {}
  }
}

function Resolve-NpmCommand([string]$installDir) {
  # Prefer system npm if available, else portable npm under installDir\tools\node\npm.cmd
  if (Test-Command "npm") {
    return @{ Type="system"; Cmd="npm"; NodeHome=$null }
  }

  $npmCmd = Join-Path $installDir "tools\node\npm.cmd"
  if (Test-Path $npmCmd) {
    return @{ Type="portable"; Cmd=$npmCmd; NodeHome=(Split-Path -Parent $npmCmd) }
  }
  return $null
}

function Copy-Project([string]$src, [string]$dst) {
  Write-Info "Creating install folder: $dst"
  New-Item -ItemType Directory -Force $dst | Out-Null

  $excludeExt = @(".mp4", ".mov", ".avi", ".mkv", ".webm")
  $excludeDirs = @("\.git\", "\node_modules\", "\BACKUPS\", "\BACKUP_CONSOLIDATION\", "\tmp\", "\uploads\", "\reports\")

  Write-Info "Copying project files (excluding videos)..."
  $items = Get-ChildItem -LiteralPath $src -Force
  foreach ($item in $items) {
    $full = $item.FullName
    $rel = $full.Substring($src.Length).TrimStart("\")
    $target = Join-Path $dst $rel

    if ($item.PSIsContainer) {
      $skip = $false
      foreach ($d in $excludeDirs) {
        if ($full -like "*$d*") { $skip = $true; break }
      }
      if ($skip) { continue }
      New-Item -ItemType Directory -Force $target | Out-Null
      Copy-Item -LiteralPath $full -Destination $target -Recurse -Force
    } else {
      $ext = [IO.Path]::GetExtension($full).ToLowerInvariant()
      if ($excludeExt -contains $ext) { continue }
      New-Item -ItemType Directory -Force (Split-Path -Parent $target) | Out-Null
      Copy-Item -LiteralPath $full -Destination $target -Force
    }
  }
}

function Initialize-ServerEnv([string]$installDir) {
  $sample = Join-Path $installDir "server\env.sample"
  $env = Join-Path $installDir "server\.env"
  if (-not (Test-Path $env) -and (Test-Path $sample)) {
    Copy-Item -LiteralPath $sample -Destination $env -Force
    Write-Info "Created server/.env from env.sample"
  }
}

function Install-ServerDeps([string]$installDir) {
  $serverDir = Join-Path $installDir "server"
  if (-not (Test-Path $serverDir)) {
    throw "server folder not found at: $serverDir"
  }
  $npm = Resolve-NpmCommand -installDir $installDir
  if (-not $npm) { throw "npm not available. Install Node.js or allow the installer to install portable Node." }

  Write-Info "Installing server dependencies (npm install)..."
  Push-Location $serverDir
  try {
    if ($npm.Type -eq "portable") {
      & $npm.Cmd install --no-audit --no-fund | Out-Host
    } else {
      npm install --no-audit --no-fund | Out-Host
    }
  } finally {
    Pop-Location
  }
}

function Write-StartScripts([string]$installDir) {
  $startServer = Join-Path $installDir "Start-Server.bat"
  $openUi = Join-Path $installDir "Open-UI.bat"
  $startAll = Join-Path $installDir "Start-LRB.bat"

  @"
@echo off
cd /d "%~dp0server"
echo Starting LRB API on http://localhost:4000 ...
set "PORTABLE_NPM=%~dp0tools\node\npm.cmd"
if exist "%PORTABLE_NPM%" (
  start "LRB API" cmd /k "\"%PORTABLE_NPM%\" start"
) else (
  start "LRB API" cmd /k "npm start"
)
"@ | Set-Content -LiteralPath $startServer -Encoding ASCII

  @"
@echo off
set "UI=%~dp0LRB Brand Reference\index LRB compliance skeleton.html"
echo Opening UI: %UI%
start "" "%UI%"
"@ | Set-Content -LiteralPath $openUi -Encoding ASCII

  @"
@echo off
call "%~dp0Start-Server.bat"
timeout /t 2 >nul
call "%~dp0Open-UI.bat"
"@ | Set-Content -LiteralPath $startAll -Encoding ASCII
}

function New-Shortcut([string]$shortcutPath, [string]$targetPath, [string]$workingDir, [string]$description) {
  $shell = New-Object -ComObject WScript.Shell
  $sc = $shell.CreateShortcut($shortcutPath)
  $sc.TargetPath = $targetPath
  $sc.WorkingDirectory = $workingDir
  $sc.Description = $description
  $sc.Save()
}

function New-DesktopShortcuts([string]$installDir) {
  $desktop = [Environment]::GetFolderPath("Desktop")
  $startAll = Join-Path $installDir "Start-LRB.bat"
  $openUi = Join-Path $installDir "Open-UI.bat"

  New-Shortcut -shortcutPath (Join-Path $desktop "LRB Jun30 - Start.lnk") -targetPath $startAll -workingDir $installDir -description "Start LRB server and open UI"
  New-Shortcut -shortcutPath (Join-Path $desktop "LRB Jun30 - Open UI.lnk") -targetPath $openUi -workingDir $installDir -description "Open LRB UI"
}

try {
  $answer = Read-Host "Do you want to do a full install of this LRB build? (Y/N)"
  if ($answer -notin @("Y","y","Yes","yes")) {
    Write-Warn "Install cancelled."
    exit 0
  }

  $sourceDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
  $installDir = (Resolve-Path $InstallRoot -ErrorAction SilentlyContinue)
  if (-not $installDir) { $installDir = $InstallRoot }
  else { $installDir = $installDir.Path }

  # Copy first so we can place portable tools into the install folder if needed
  Copy-Project -src $sourceDir -dst $installDir

  # Node.js prerequisite:
  # - If Node/npm exists already, use it.
  # - Else if winget exists, install Node LTS silently.
  # - Else download portable Node into the install folder (no admin).
  if (-not (Test-Command "node") -or -not (Test-Command "npm")) {
    if (Test-Command "winget") {
      Assert-Tool -toolName "node" -wingetId "OpenJS.NodeJS.LTS"
    } else {
      Write-Warn "winget not available. Falling back to portable Node (no admin required)."
      Install-PortableNode -installDir $installDir | Out-Null
    }
  }

  Initialize-ServerEnv -installDir $installDir
  Install-ServerDeps -installDir $installDir
  Write-StartScripts -installDir $installDir

  if (-not $NoShortcuts) {
    New-DesktopShortcuts -installDir $installDir
  }

  Write-Info "Install complete."
  Write-Host ""
  Write-Host "Next:" -ForegroundColor Green
  Write-Host "  - Double-click 'LRB Jun30 - Start' on your Desktop" -ForegroundColor Green
  Write-Host ""
} catch {
  Write-Err $_.Exception.Message
  exit 1
}


