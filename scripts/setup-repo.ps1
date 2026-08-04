<#
.SYNOPSIS
    Step 4: Clone/pull repository and install dependencies.
.DESCRIPTION
    Clones the CodeJet repo to ~/.codejet if missing, or pulls
    latest changes if it exists. Installs npm dependencies and
    adds the repo to the user PATH.
.NOTES
    Author: Itarqos
    Version: 1.3.0
#>

$ErrorActionPreference = "Stop"

# Dot-source utilities
. "$PSScriptRoot\utils.ps1"

Write-Step "4/5" "Setting up CodeJet repository..."

$repoUrl = "https://github.com/itarqos5/codejet.git"
$codejetDir = "$env:USERPROFILE\.codejet"
$targetDir = $codejetDir

if (Test-Path $targetDir) {
    # Check if directory is actually a valid git repo
    $isGitRepo = $false
    Push-Location $targetDir
    try {
        git rev-parse --git-dir 2>$null | Out-Null
        $isGitRepo = $LASTEXITCODE -eq 0
    } catch { }
    Pop-Location

    if ($isGitRepo) {
        Write-Info "Repository exists, pulling latest changes..."
        Push-Location $targetDir
        Show-ProgressBar "Pulling changes" 0
        git pull origin main 2>$null | Out-Null
        Show-ProgressBar "Pulling changes" 100
        Pop-Location
    } else {
        Write-Warning "Directory exists but is not a valid git repository"
        Write-Info "Removing and re-cloning..."
        Remove-Item -Path $targetDir -Recurse -Force
        Show-ProgressBar "Cloning" 0
        git clone $repoUrl $targetDir 2>$null | Out-Null
        Show-ProgressBar "Cloning" 100
    }
} else {
    Write-Info "Cloning repository..."
    Show-ProgressBar "Cloning" 0
    git clone $repoUrl $targetDir 2>$null | Out-Null
    Show-ProgressBar "Cloning" 100
}

Push-Location $targetDir

Write-Info "Installing npm dependencies..."
Show-ProgressBar "npm install" 0
npm install 2>$null | Out-Null
Show-ProgressBar "npm install" 100

Write-Success "Dependencies installed"

# Add to PATH if not present
$codejetBin = "$targetDir"
$currentPath = [System.Environment]::GetEnvironmentVariable("PATH", "User")
if ($currentPath -notlike "*$codejetBin*") {
    Write-Info "Adding CodeJet to user PATH..."
    $newPath = $currentPath + ";$codejetBin"
    [System.Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
    $env:PATH = $newPath
    Write-Success "Added to PATH (restart terminal to take effect)"
} else {
    Write-Success "Already in PATH"
}

Pop-Location
