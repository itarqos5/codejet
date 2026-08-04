<#
.SYNOPSIS
    CodeJet Production Installation Script
.DESCRIPTION
    Installs CodeJet CLI tool with OpenCode and Kilo Code integration.
    Must be run as Administrator.
.NOTES
    Author: Itarqos
    Version: 1.3.0
#>

# --- Elevation Check ---
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "  [X] This script must be run as Administrator." -ForegroundColor Red
    Write-Host ""
    Write-Host "  Right-click 'PowerShell' and choose 'Run as administrator',"
    Write-Host "  then run the install command again in that window."
    Write-Host ""
    exit 1
}

$ErrorActionPreference = "Stop"

# Resolve script directory for dot-sourcing
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

# --- Step 5: Completion ---
. "$scriptsDir\complete.ps1"

# --- End ---
