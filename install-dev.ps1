<# 
.SYNOPSIS
    CodeJet Development Installation Script (UI Mock)
.DESCRIPTION
    Simulates the full installation UI flow without making system changes.
    Use for testing and polishing the setup UX instantly.
.NOTES
    Author: Itarqos
    Version: 1.0.0
#>

$ErrorActionPreference = "Stop"

# ─── Color Definitions ───
$esc = [char]27
$AnsiCyan = "$esc[36m"
$AnsiGreen = "$esc[32m"
$AnsiYellow = "$esc[33m"
$AnsiRed = "$esc[31m"
$AnsiReset = "$esc[0m"
$AnsiBold = "$esc[1m"
$AnsiDim = "$esc[2m"

# ─── Helper Functions ───
function Write-Banner {
    param([string]$Text)
    $width = 60
    $padding = [math]::Max(0, ($width - $Text.Length) / 2)
    $line = "═" * $width
    Write-Host ""
    Write-Host ($AnsiCyan + $line + $AnsiReset)
    Write-Host ($AnsiCyan + " " * $padding + $AnsiBold + $Text + $AnsiReset + $AnsiCyan + " " * ($width - $padding - $Text.Length) + $AnsiReset)
    Write-Host ($AnsiCyan + $line + $AnsiReset)
    Write-Host ""
}

function Write-Step {
    param([string]$Step, [string]$Message)
    Write-Host ($AnsiCyan + "▶ " + $AnsiBold + "Step $Step" + $AnsiReset + $AnsiCyan + ": " + $Message + $AnsiReset)
}

function Write-Success {
    param([string]$Message)
    Write-Host ($AnsiGreen + "  ✓ " + $Message + $AnsiReset)
}

function Write-Warning {
    param([string]$Message)
    Write-Host ($AnsiYellow + "  ⚠ " + $Message + $AnsiReset)
}

function Write-Error {
    param([string]$Message)
    Write-Host ($AnsiRed + "  ✗ " + $Message + $AnsiReset)
}

function Write-Info {
    param([string]$Message)
    Write-Host ($AnsiDim + "  ℹ " + $Message + $AnsiReset)
}

function Show-ProgressBar {
    param([string]$Title, [int]$Percent, [int]$Width = 40, [int]$Delay = 50)
    $filled = [math]::Floor($Width * $Percent / 100)
    $empty = $Width - $filled
    $bar = $AnsiCyan + "█" * $filled + $AnsiDim + "░" * $empty + $AnsiReset
    Write-Host ("`r$Title [$bar] $Percent%") -NoNewline
    if ($Percent -ge 100) { Write-Host "" }
}

function Simulate-Progress {
    param([string]$Title, [int]$Steps = 20, [int]$Delay = 80)
    for ($i = 0; $i -le $Steps; $i++) {
        $pct = [math]::Floor(100 * $i / $Steps)
        Show-ProgressBar $Title $pct
        Start-Sleep -Milliseconds $Delay
    }
    Write-Host ""
}

function Prompt-YesNo {
    param([string]$Prompt, [bool]$Default = $true)
    $suffix = if ($Default) { " [Y/n] " } else { " [y/N] " }
    while ($true) {
        Write-Host ($AnsiCyan + $Prompt + $suffix + $AnsiReset) -NoNewline
        $key = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        Write-Host ""
        $char = $key.Character.ToLower()
        if ($char -eq 'y') { return $true }
        if ($char -eq 'n') { return $false }
        if ($char -eq '' -and $Default) { return $true }
        if ($char -eq '' -and -not $Default) { return $false }
    }
}

function Prompt-Menu {
    param([string]$Prompt, [string[]]$Options)
    $selected = 0
    try { $Host.UI.RawUI.CursorVisible = $false } catch { }
    try {
        while ($true) {
            Write-Host ($AnsiCyan + $Prompt + $AnsiReset)
            for ($i = 0; $i -lt $Options.Length; $i++) {
                $prefix = if ($i -eq $selected) { $AnsiCyan + "▶ " + $AnsiBold } else { "  " }
                $suffix = if ($i -eq $selected) { $AnsiReset } else { "" }
                Write-Host ("$prefix$($Options[$i])$suffix")
            }
            $key = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            switch ($key.VirtualKeyCode) {
                38 { $selected = ($selected - 1 + $Options.Length) % $Options.Length } # Up
                40 { $selected = ($selected + 1) % $Options.Length } # Down
                13 { break } # Enter
            }
            # Clear previous lines
            for ($i = 0; $i -le $Options.Length; $i++) {
                [Console]::SetCursorPosition(0, [Console]::CursorTop - 1)
                Write-Host (" " * 80)
                [Console]::SetCursorPosition(0, [Console]::CursorTop - 1)
            }
        }
    } finally {
        try { $Host.UI.RawUI.CursorVisible = $true } catch { }
    }
    return $selected
}

function Simulate-Check {
    param([string]$Name, [bool]$Found = $true, [string]$Version = "")
    if ($Found) {
        if ($Version) {
            Write-Success "$Name found: $Version"
        } else {
            Write-Success "$Name found"
        }
    } else {
        Write-Warning "$Name not found"
    }
    Start-Sleep -Milliseconds 300
}

# ─── Main Mock Installation Flow ───
Write-Banner "CodeJet Installation (DEV MODE)"
Write-Host ($AnsiDim + "  This is a UI mock - no actual system changes will be made." + $AnsiReset)
Write-Host ($AnsiDim + "  Press Ctrl+C at any time to exit." + $AnsiReset)
Write-Host ""

# ─── Step 1: System Dependency Checks (Mock) ───
Write-Step "1/5" "Checking system dependencies (simulated)..."
Simulate-Progress "Scanning PATH" 15 60
Simulate-Check "Node.js" $true "v20.12.0"
Simulate-Check "Git" $true "2.44.0"
Simulate-Check "npm" $true "10.5.0"
Start-Sleep -Milliseconds 500

# ─── Step 2: OpenCode & Kilo Code CLI Check (Mock) ───
Write-Step "2/5" "Checking OpenCode & Kilo Code CLI (simulated)..."
Simulate-Progress "Verifying CLI tools" 10 80
Simulate-Check "opencode" $true "v2.x"
Simulate-Check "kilo" $true "v1.x"
Write-Success "OpenCode CLI found"
Write-Success "Kilo Code CLI found"
Start-Sleep -Milliseconds 500

# ─── Step 3: Auth / Token Extraction (Mock) ───
Write-Step "3/5" "Checking authentication tokens (simulated)..."
Simulate-Progress "Reading auth configs" 10 80

Write-Success "OpenCode authentication token found"
Write-Success "Kilo Code authentication token found"

Write-Step "3b" "Saving tokens to keys.json (simulated)..."
Simulate-Progress "Writing ~/.codejet/keys.json" 5 100
Write-Success "Authentication tokens saved (simulated)"
Start-Sleep -Milliseconds 500

# ─── Step 4: Repository & Dependency Setup (Mock) ───
Write-Step "4/5" "Setting up CodeJet repository (simulated)..."
Simulate-Progress "Verifying ~/.codejet repository" 8 50
Write-Success "Repository already present at ~/.codejet (simulated)"
Simulate-Progress "npm install" 20 40
Write-Success "Dependencies installed (simulated)"
Simulate-Progress "Adding to PATH" 5 100
Write-Success "Added to user PATH (simulated)"
Start-Sleep -Milliseconds 500

# ─── Step 5: Completion ───
Write-Step "5/5" "Installation complete (simulated)!"

Write-Host ""
Write-Banner "🎉 CodeJet installed successfully!"
Write-Host ($AnsiGreen + "  Run 'codejet' to use the CLI tool!" + $AnsiReset)
Write-Host ($AnsiDim + "  Note: This was a simulation - no actual changes were made." + $AnsiReset)
Write-Host ($AnsiDim + "  Run install.ps1 for the real installation." + $AnsiReset)
Write-Host ""

# ─── End ───