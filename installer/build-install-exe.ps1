<# 
Builds install.exe from Install-LRB.ps1 using PS2EXE.

Run from repo root:
  powershell -ExecutionPolicy Bypass -File .\installer\build-install-exe.ps1

Output:
  .\installer\install.exe
#>

[CmdletBinding()]
param(
  [string]$InputScript,
  [string]$OutputExe
)

$ErrorActionPreference = "Stop"

function Write-Info([string]$msg) { Write-Host "[build] $msg" -ForegroundColor Cyan }

function Get-ScriptDir() {
  $p = $MyInvocation.MyCommand.Path
  if ($p) { return (Split-Path -Parent $p) }
  if ($PSScriptRoot) { return $PSScriptRoot }
  return (Get-Location).Path
}

Write-Info "Ensuring PS2EXE module..."
try {
  if (-not (Get-Module -ListAvailable -Name ps2exe)) {
    Set-PSRepository -Name "PSGallery" -InstallationPolicy Trusted | Out-Null
    Install-Module -Name ps2exe -Scope CurrentUser -Force
  }
} catch {
  throw "Failed to install ps2exe. Error: $($_.Exception.Message)"
}

Import-Module ps2exe -Force

$scriptDir = Get-ScriptDir
if (-not $InputScript) { $InputScript = Join-Path $scriptDir "Install-LRB.ps1" }
if (-not $OutputExe) { $OutputExe = Join-Path $scriptDir "install.exe" }

Write-Info "ScriptDir: $scriptDir"
Write-Info "InputScript: $InputScript"
Write-Info "OutputExe: $OutputExe"

if (-not (Test-Path $InputScript)) {
  throw "Input script not found: $InputScript"
}

Write-Info "Compiling $InputScript -> $OutputExe"

# ps2exe will embed the script into an exe wrapper.
if (Test-Path $OutputExe) {
  Remove-Item -LiteralPath $OutputExe -Force
}

# Build a console EXE (omit -noConsole switch). Default is console.
Invoke-PS2EXE -InputFile $InputScript -OutputFile $OutputExe -x64 -noConfigFile

Write-Info "Done."
Write-Info "Installer EXE: $OutputExe"


