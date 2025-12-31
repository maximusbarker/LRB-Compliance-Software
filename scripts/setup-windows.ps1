# LRB Website setup automation (Windows + PowerShell)
# - Installs/updates nvm automatically (downloads installer if missing)
# - Ensures Node 20.17.0 (default) is installed and active via nvm
# - Installs server dependencies, seeds env config, and optionally runs migrations
#
# Usage (from repo root):
#   powershell -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1
#
# Flags worth knowing:
#   -NodeVersion 18.19.0        # install/use a different Node
#   -NvmInstallerPath C:\foo    # re-use an offline nvm installer
#   -NvmDownloadUrl https://... # override download source
#   -SkipMigrations             # install deps but skip npm run db:migrate
#   -SkipEnvCopy                # do not auto-create server/.env from env.sample
#
# Notes:
# - Everything installs user-local (no admin required).
# - In a fresh shell after running this, execute `nvm use <version>` before working.

param(
    [string]$NodeVersion = "20.17.0",
    [string]$NvmInstallerPath,
    [string]$NvmDownloadUrl = "https://github.com/coreybutler/nvm-windows/releases/download/1.1.12/nvm-setup.exe",
    [switch]$SkipMigrations,
    [switch]$SkipEnvCopy
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ensure-Tls12 {
    $tls12 = [System.Net.SecurityProtocolType]::Tls12
    if (-not ([System.Enum]::GetValues([System.Net.SecurityProtocolType]) -contains $tls12)) {
        return
    }
    if (-not ([System.Net.ServicePointManager]::SecurityProtocol.HasFlag($tls12))) {
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor $tls12
    }
}

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ServerDir = Join-Path $RepoRoot "server"
$EnvSamplePath = Join-Path $ServerDir "env.sample"
$EnvFilePath = Join-Path $ServerDir ".env"

if (-not $NvmInstallerPath) {
    $NvmInstallerPath = Join-Path $RepoRoot "nvm-setup.exe"
}

$script:NvmInstallerPath = $NvmInstallerPath
$script:NvmDownloadUrl = $NvmDownloadUrl

$NvmRoot = Join-Path $env:LOCALAPPDATA "nvm"
$NvmSymlink = "C:\nvm4w\nodejs"
$NvmExe = Join-Path $NvmRoot "nvm.exe"

function Get-OrDownloadNvmInstaller {
    if (Test-Path $script:NvmInstallerPath) {
        Write-Host "Using nvm installer at $($script:NvmInstallerPath)"
        return
    }

    Ensure-Tls12
    $downloadTarget = Join-Path ([System.IO.Path]::GetTempPath()) "lrb-nvm-setup.exe"
    Write-Host "Downloading nvm from $($script:NvmDownloadUrl)..."
    Invoke-WebRequest -Uri $script:NvmDownloadUrl -OutFile $downloadTarget
    $script:NvmInstallerPath = $downloadTarget
    Write-Host "Saved nvm installer to $downloadTarget"
}

function Ensure-Nvm {
    if (Test-Path $NvmExe) {
        Write-Host "nvm already installed at $NvmExe"
        return
    }

    Get-OrDownloadNvmInstaller
    Write-Host "Installing nvm from $($script:NvmInstallerPath) to $NvmRoot ..."
    Start-Process -FilePath $script:NvmInstallerPath -ArgumentList "/S /D=$NvmRoot" -Wait

    if (-not (Test-Path $NvmExe)) {
        throw "nvm installation did not produce $NvmExe. Run the installer manually."
    }
}

function Use-NodeVersion {
    param([string]$Version)

    $list = (& $NvmExe list) -join "`n"
    if ($list -notmatch [regex]::Escape($Version)) {
        Write-Host "Installing Node $Version via nvm..."
        & $NvmExe install $Version
    } else {
        Write-Host "Node $Version already installed."
    }

    Write-Host "Switching to Node $Version ..."
    & $NvmExe use $Version

    # Refresh PATH for this session to ensure node/npm are available
    $env:NVM_HOME = $NvmRoot
    $env:NVM_SYMLINK = $NvmSymlink
    $deduped = New-Object System.Collections.Generic.HashSet[string]
    foreach ($entry in $env:PATH -split ";") {
        if ([string]::IsNullOrWhiteSpace($entry)) { continue }
        $deduped.Add($entry) | Out-Null
    }
    $deduped.Add($env:NVM_HOME) | Out-Null
    $deduped.Add($env:NVM_SYMLINK) | Out-Null
    $env:PATH = ($deduped.ToArray()) -join ";"
}

function Install-ServerDependencies {
    Push-Location $ServerDir
    try {
        Write-Host "Installing server dependencies in $ServerDir ..."
        npm install
        Write-Host "Installed dependencies. Node $(node -v), npm $(npm -v)"
    } finally {
        Pop-Location
    }
}

function Ensure-EnvFile {
    if ($SkipEnvCopy) {
        Write-Host "Skipping env file copy (per flag)."
        return
    }

    if (Test-Path $EnvFilePath) {
        Write-Host ".env already exists at $EnvFilePath"
        return
    }

    if (-not (Test-Path $EnvSamplePath)) {
        Write-Warning "env.sample not found at $EnvSamplePath; skipping env creation."
        return
    }

    Copy-Item $EnvSamplePath $EnvFilePath
    Write-Host "Created $EnvFilePath from env.sample (defaults are local-friendly)."
}

function Run-DatabaseMigrations {
    if ($SkipMigrations) {
        Write-Host "Skipping database migrations (per flag)."
        return
    }

    Push-Location $ServerDir
    try {
        Write-Host "Running database migrations (npm run db:migrate)..."
        npm run db:migrate
    } finally {
        Pop-Location
    }
}

Ensure-Nvm
Use-NodeVersion -Version $NodeVersion
Install-ServerDependencies
Ensure-EnvFile
Run-DatabaseMigrations

Write-Host ""
Write-Host "Setup complete."
Write-Host "Next steps:"
Write-Host "  - From server/: npm run dev (or npm start) to boot the API."
Write-Host "  - Uploads land in ..\uploads by default; keep that folder alongside server/."
Write-Host ""
Write-Host "Reminder: In a new shell run 'nvm use $NodeVersion' before working."

