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

    # Move to a valid directory so git doesn't fail on invalid CWD
    Set-Location $env:USERPROFILE

    # --- Verify git is installed ---
    $hasGit = $false
    try { $null = Get-Command git -ErrorAction Stop; $hasGit = $true } catch { }

    if (-not $hasGit) {
        Write-Host "$esc[33m  [!] Git not found. Installing via winget...$esc[0m"
        try {
            winget install --id Git.Git --silent --accept-source-agreements --accept-package-agreements
            $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
            try { $null = Get-Command git -ErrorAction Stop; $hasGit = $true } catch { }
        } catch { }
        if (-not $hasGit) {
            Write-Host "$esc[31m  [X] Git installation failed. Please install manually from https://git-scm.com$esc[0m"
            exit 1
        }
        Write-Host "$esc[32m  [OK] Git installed successfully$esc[0m"
    } else {
        Write-Host "$esc[2m  [i] Git found: $(git --version)$esc[0m"
    }

    $repoUrl = "https://github.com/itarqos5/codejet.git"
    $targetDir = "$env:USERPROFILE\.codejet"

    if (Test-Path "$targetDir\.git") {
        Write-Host "$esc[2m  [i] Repository exists, pulling latest...$esc[0m"
        Push-Location $targetDir
        $null = git pull origin main 2>&1
        Pop-Location
    } else {
        if (Test-Path $targetDir) {
            Remove-Item -Path $targetDir -Recurse -Force
        }
        Write-Host "$esc[2m  [i] Cloning CodeJet repository...$esc[0m"
        $null = git clone $repoUrl $targetDir 2>&1
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
