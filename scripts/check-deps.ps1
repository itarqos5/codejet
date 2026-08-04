<#
.SYNOPSIS
    Step 1: Check and install system dependencies (Node.js, Git).
.DESCRIPTION
    Verifies Node.js and Git are installed, offering to install
    missing dependencies via winget if needed.
.NOTES
    Author: Itarqos
    Version: 1.3.0
#>

param(
    [switch]$SkipElevationCheck
)

$ErrorActionPreference = "Stop"

# Dot-source utilities
. "$PSScriptRoot\utils.ps1"

Write-Step "1/5" "Checking system dependencies..."

$hasNode = Check-Command "node"
$hasGit = Check-Command "git"

if (-not $hasNode) {
    Write-Warning "Node.js not found"
    if (Prompt-YesNo "Install Node.js via winget?") {
        if (-not (Install-ViaWinget "OpenJS.NodeJS" "Node.js")) {
            Write-Error "Node.js installation failed. Please install manually from https://nodejs.org"
            exit 1
        }
        Refresh-Path
        $hasNode = Check-Command "node"
    } else {
        Write-Error "Node.js is required. Exiting."
        exit 1
    }
} else {
    $nodeVersion = node --version
    Write-Success "Node.js found: $nodeVersion"
}

if (-not $hasGit) {
    Write-Warning "Git not found"
    if (Prompt-YesNo "Install Git via winget?") {
        if (-not (Install-ViaWinget "Git.Git" "Git")) {
            Write-Error "Git installation failed. Please install manually from https://git-scm.com"
            exit 1
        }
        Refresh-Path
        $hasGit = Check-Command "git"
    } else {
        Write-Error "Git is required. Exiting."
        exit 1
    }
} else {
    $gitVersion = git --version
    Write-Success "Git found: $gitVersion"
}
