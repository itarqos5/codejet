<#
.SYNOPSIS
    Step 2: Check and install OpenCode / Kilo Code CLI tools.
.DESCRIPTION
    Verifies opencode and kilo CLI tools are available globally,
    offering to install them via npm if missing.
.NOTES
    Author: Itarqos
    Version: 1.3.0
#>

$ErrorActionPreference = "Stop"

# Dot-source utilities
. "$PSScriptRoot\utils.ps1"

Write-Step "2/5" "Checking OpenCode and Kilo Code CLI..."

$hasOpencode = Check-Command "opencode"
$hasKilo = Check-Command "kilo"

if (-not $hasOpencode -or -not $hasKilo) {
    $missing = @()
    if (-not $hasOpencode) { $missing += "opencode" }
    if (-not $hasKilo) { $missing += "kilo" }
    Write-Warning "Missing CLI tools: $([string]::Join(", ", $missing))"

    $menuChoice = Prompt-Menu "Install missing CLI tools globally via npm?" @(
        "Install OpenCode and Kilo Code",
        "Cancel Installation"
    )

    if ($menuChoice -eq 1) {
        Write-Info "Installation cancelled by user."
        exit 0
    }

    Write-Step "2a" "Installing OpenCode and Kilo Code globally..."
    Show-ProgressBar "Installing opencode" 0
    npm install -g opencode 2>$null | Out-Null
    Show-ProgressBar "Installing opencode" 50
    npm install -g @kilocode/cli 2>$null | Out-Null
    Show-ProgressBar "Installing @kilocode/cli" 100

    $hasOpencode = Check-Command "opencode"
    $hasKilo = Check-Command "kilo"

    if ($hasOpencode) { Write-Success "OpenCode installed" } else { Write-Error "OpenCode installation failed" }
    if ($hasKilo) { Write-Success "Kilo Code installed" } else { Write-Error "Kilo Code installation failed" }
} else {
    Write-Success "OpenCode CLI found"
    Write-Success "Kilo Code CLI found"
}
