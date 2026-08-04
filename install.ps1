<#
.SYNOPSIS
    CodeJet Installation Script
.DESCRIPTION
    Installs CodeJet CLI tool with OpenCode and Kilo Code integration.
    Supports both local execution and remote install via:
        iwr -useb https://raw.githubusercontent.com/itarqos5/codejet/main/install.ps1 | iex
.NOTES
    Author: Itarqos
    Version: 1.4.0
#>

# --- Admin check helper ---
function Test-Admin {
    $principal = New-Object Security.Principal.WindowsPrincipal(
        [Security.Principal.WindowsIdentity]::GetCurrent()
    )
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Assert-Admin {
    if (-not (Test-Admin)) {
        Write-Host "  [X] This script must be run as Administrator." -ForegroundColor Red
        Write-Host ""
        Write-Host "  Right-click 'PowerShell' and choose 'Run as administrator',"
        Write-Host "  then run the install command again in that window."
        Write-Host ""
        exit 1
    }
}

# ============================================================
#  REMOTE PATH - piped via iwr | iex ($PSScriptRoot is empty)
# ============================================================
if (-not $PSScriptRoot) {
    Assert-Admin

    $esc = [char]27
    Write-Host ""
    Write-Host "$esc[36m============================================================$esc[0m"
    Write-Host "$esc[36m                    CodeJet Bootstrap$esc[0m"
    Write-Host "$esc[36m============================================================$esc[0m"
    Write-Host ""

    $repoUrl = "https://github.com/itarqos5/codejet.git"
    $targetDir = "$env:USERPROFILE\.codejet"

    if (Test-Path "$targetDir\.git") {
        Write-Host "$esc[2m  [i] Repository exists, pulling latest...$esc[0m"
        Push-Location $targetDir
        git pull origin main 2>$null | Out-Null
        Pop-Location
    } else {
        if (Test-Path $targetDir) {
            Remove-Item -Path $targetDir -Recurse -Force
        }
        Write-Host "$esc[2m  [i] Cloning CodeJet repository...$esc[0m"
        git clone $repoUrl $targetDir 2>$null | Out-Null
    }

    Write-Host "$esc[2m  [i] Starting installer...$esc[0m"
    Write-Host ""
    & "$targetDir\install.ps1"
    exit $LASTEXITCODE
}

# ============================================================
#  LOCAL PATH - running from cloned repo ($PSScriptRoot set)
# ============================================================
Assert-Admin
$ErrorActionPreference = "Stop"

$scriptsDir = Join-Path $PSScriptRoot "scripts"

# --- Banner ---
. "$scriptsDir\utils.ps1"
Write-Banner "CodeJet Installation"

# --- Step 1: System Dependencies ---
. "$scriptsDir\check-deps.ps1"

# --- Step 2: CLI Tools ---
. "$scriptsDir\check-cli.ps1"

# --- Step 3: Auth Tokens ---
. "$scriptsDir\setup-auth.ps1"

# --- Step 4: Repository Setup ---
. "$scriptsDir\setup-repo.ps1"

# --- Save auth tokens to keys.json after clone ---
$codejetDir = "$env:USERPROFILE\.codejet"
$keysPath = "$codejetDir\keys.json"
if ($script:opencodeToken -or $script:kiloToken) {
    if (-not (Test-Path $codejetDir)) {
        New-Item -ItemType Directory -Path $codejetDir -Force | Out-Null
    }
    $kiloValue = if ($script:kiloToken) { $script:kiloToken } else { "" }
    $opencodeValue = if ($script:opencodeToken) { $script:opencodeToken } else { "" }
    $keys = @{
        kilo_token = $kiloValue
        opencode_token = $opencodeValue
    } | ConvertTo-Json -Depth 3
    Set-Content -Path $keysPath -Value $keys -Encoding UTF8
    Write-Success "Authentication tokens saved to $keysPath"
}

# --- Step 5: Completion ---
. "$scriptsDir\complete.ps1"

# --- End ---
