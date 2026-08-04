<#
.SYNOPSIS
    Shared utility functions for CodeJet installation scripts.
.DESCRIPTION
    Contains color definitions, UI helpers, and common utility functions
    used across all installation steps.
.NOTES
    Author: Itarqos
    Version: 1.3.0
#>

# --- Color Definitions ---
$esc = [char]27
$script:AnsiCyan = "$esc[36m"
$script:AnsiGreen = "$esc[32m"
$script:AnsiYellow = "$esc[33m"
$script:AnsiRed = "$esc[31m"
$script:AnsiReset = "$esc[0m"
$script:AnsiBold = "$esc[1m"
$script:AnsiDim = "$esc[2m"

# --- Output Functions ---
function Write-Banner {
    param([string]$Text)
    $width = 60
    $padding = [math]::Max(0, ($width - $Text.Length) / 2)
    $line = "=" * $width
    Write-Host ""
    Write-Host ($script:AnsiCyan + $line + $script:AnsiReset)
    Write-Host ($script:AnsiCyan + " " * $padding + $script:AnsiBold + $Text + $script:AnsiReset + $script:AnsiCyan + " " * ($width - $padding - $Text.Length) + $script:AnsiReset)
    Write-Host ($script:AnsiCyan + $line + $script:AnsiReset)
    Write-Host ""
}

function Write-Step {
    param([string]$Step, [string]$Message)
    Write-Host ($script:AnsiCyan + ">> " + $script:AnsiBold + "Step $Step" + $script:AnsiReset + $script:AnsiCyan + ": " + $Message + $script:AnsiReset)
}

function Write-Success {
    param([string]$Message)
    Write-Host ($script:AnsiGreen + "  [OK] " + $Message + $script:AnsiReset)
}

function Write-Warning {
    param([string]$Message)
    Write-Host ($script:AnsiYellow + "  [!] " + $Message + $script:AnsiReset)
}

function Write-Error {
    param([string]$Message)
    Write-Host ($script:AnsiRed + "  [X] " + $Message + $script:AnsiReset)
}

function Write-Info {
    param([string]$Message)
    Write-Host ($script:AnsiDim + "  [i] " + $Message + $script:AnsiReset)
}

function Show-ProgressBar {
    param([string]$Title, [int]$Percent, [int]$Width = 40)
    $filled = [math]::Floor($Width * $Percent / 100)
    $empty = $Width - $filled
    $bar = $script:AnsiCyan + "#" * $filled + $script:AnsiDim + "-" * $empty + $script:AnsiReset
    Write-Host ("`r$Title [$bar] $Percent%") -NoNewline
    if ($Percent -ge 100) { Write-Host "" }
}

# --- Prompt Functions ---
function Prompt-YesNo {
    param([string]$Prompt, [bool]$Default = $true)
    $suffix = if ($Default) { " [Y/n] " } else { " [y/N] " }
    while ($true) {
        Write-Host ($script:AnsiCyan + $Prompt + $suffix + $script:AnsiReset) -NoNewline
        $choice = ""
        try {
            $key = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            Write-Host ""
            $choice = [string]$key.KeyChar
        } catch {
            Write-Host ""
            try { $choice = [string](Read-Host) } catch { $choice = "" }
        }
        if ($choice -match '^[yY]') { return $true }
        if ($choice -match '^[nN]') { return $false }
        if ($choice -eq "`r" -or $choice -eq "`n" -or $choice -eq "") { return $Default }
        Write-Warning "Please press Y (yes) or N (no)."
    }
}

function Prompt-Menu {
    param([string]$Prompt, [string[]]$Options)
    $selected = 0
    try { $Host.UI.RawUI.CursorVisible = $false } catch { }
    try {
        while ($true) {
            Write-Host ($script:AnsiCyan + $Prompt + $script:AnsiReset)
            for ($i = 0; $i -lt $Options.Length; $i++) {
                $prefix = if ($i -eq $selected) { $script:AnsiCyan + "> " + $script:AnsiBold } else { "  " }
                $suffix = if ($i -eq $selected) { $script:AnsiReset } else { "" }
                Write-Host ("$prefix$($Options[$i])$suffix")
            }
            $key = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            switch ($key.VirtualKeyCode) {
                38 { $selected = ($selected - 1 + $Options.Length) % $Options.Length } # Up
                40 { $selected = ($selected + 1) % $Options.Length } # Down
                13 { break } # Enter
            }
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

# --- Utility Functions ---
function Check-Command {
    param([string]$Command)
    try {
        $null = Get-Command $Command -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

function Install-ViaWinget {
    param([string]$PackageId, [string]$Name)
    Write-Step "DEP" "Installing $Name via winget..."
    try {
        winget install --id $PackageId --silent --accept-source-agreements --accept-package-agreements
        return $true
    } catch {
        Write-Error "Failed to install $Name via winget"
        return $false
    }
}

function Refresh-Path {
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
}
