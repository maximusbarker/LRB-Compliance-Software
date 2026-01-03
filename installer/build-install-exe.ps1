<# 
Builds install.exe from Install-LRB.ps1 using PS2EXE.

Run from repo root:
  powershell -ExecutionPolicy Bypass -File .\installer\build-install-exe.ps1

Output:
  .\installer\install.exe
#>

[CmdletBinding()]
param(
  [string]$InputScript = "$PSScriptRoot\Install-LRB.ps1",
  [string]$OutputExe = "$PSScriptRoot\install.exe"
)

$ErrorActionPreference = "Stop"

function Write-Info([string]$msg) { Write-Host "[build] $msg" -ForegroundColor Cyan }

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

if (-not (Test-Path $InputScript)) {
  throw "Input script not found: $InputScript"
}

Write-Info "Compiling $InputScript -> $OutputExe"

# ps2exe will embed the script into an exe wrapper.
Invoke-PS2EXE -InputFile $InputScript -OutputFile $OutputExe -NoConsole:$false -Force

Write-Info "Done."
Write-Info "Installer EXE: $OutputExe"


