<# 
.SYNOPSIS
    CodeJet Production Installation Script
.DESCRIPTION
    Installs CodeJet CLI tool with OpenCode & Kilo Code integration
.NOTES
    Author: Itarqos
    Version: 1.0.0
#>

$ErrorActionPreference = "Stop"

# ─── Color Definitions ───
$Cyan = [System.ConsoleColor]::Cyan
$Green = [System.ConsoleColor]::Green
$Yellow = [System.ConsoleColor]::Yellow
$Red = [System.ConsoleColor]::Red
$White = [System.ConsoleColor]::White
$Gray = [System.ConsoleColor]::DarkGray
$Reset = [System.ConsoleColor]::Gray

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
    param([string]$Title, [int]$Percent, [int]$Width = 40)
    $filled = [math]::Floor($Width * $Percent / 100)
    $empty = $Width - $filled
    $bar = $AnsiCyan + "█" * $filled + $AnsiDim + "░" * $empty + $AnsiReset
    Write-Host ("`r$Title [$bar] $Percent%") -NoNewline
    if ($Percent -ge 100) { Write-Host "" }
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

# ─── Main Installation Flow ───
Write-Banner "CodeJet Installation"

# ─── Step 1: System Dependency Checks ───
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
        $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
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
        $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
        $hasGit = Check-Command "git"
    } else {
        Write-Error "Git is required. Exiting."
        exit 1
    }
} else {
    $gitVersion = git --version
    Write-Success "Git found: $gitVersion"
}

# ─── Step 2: OpenCode & Kilo Code CLI Check & Auth Setup ───
Write-Step "2/5" "Checking OpenCode & Kilo Code CLI..."

$hasOpencode = Check-Command "opencode"
$hasKilo = Check-Command "kilo"

if (-not $hasOpencode -or -not $hasKilo) {
    Write-Warning "Missing CLI tools: $([string]::Join(', ', @((if (-not $hasOpencode) { 'opencode' }), (if (-not $hasKilo) { 'kilo' }))))"
    
    $menuChoice = Prompt-Menu "Install missing CLI tools globally via npm?" @(
        "Install OpenCode & Kilo Code",
        "Cancel Installation"
    )
    
    if ($menuChoice -eq 1) {
        Write-Info "Installation cancelled by user."
        exit 0
    }
    
    Write-Step "2a" "Installing OpenCode & Kilo Code globally..."
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

# ─── Step 3: Auth / Token Extraction ───
Write-Step "3/5" "Checking authentication tokens..."

$codejetDir = "$env:USERPROFILE\.codejet"
$keysPath = "$codejetDir\keys.json"

$opencodeAuthPaths = @(
    "$env:LOCALAPPDATA\opencode\auth.json",
    "$env:USERPROFILE\.local\share\opencode\auth.json",
    "$env:HOME\.local\share\opencode\auth.json"
)

$kiloAuthPaths = @(
    "$env:USERPROFILE\.config\kilo\auth.json",
    "$env:HOME\.config\kilo\auth.json"
)

$opencodeToken = $null
$kiloToken = $null

# Check OpenCode auth
foreach ($path in $opencodeAuthPaths) {
    if (Test-Path $path) {
        try {
            $auth = Get-Content $path -Raw | ConvertFrom-Json
            if ($auth.token) { $opencodeToken = $auth.token; break }
            if ($auth.access_token) { $opencodeToken = $auth.access_token; break }
        } catch { }
    }
}

# Check Kilo Code auth
foreach ($path in $kiloAuthPaths) {
    if (Test-Path $path) {
        try {
            $auth = Get-Content $path -Raw | ConvertFrom-Json
            if ($auth.token) { $kiloToken = $auth.token; break }
            if ($auth.access_token) { $kiloToken = $auth.access_token; break }
        } catch { }
    }
}

# Try kilo auth status command
if (-not $kiloToken -and $hasKilo) {
    try {
        $status = kilo auth status 2>$null
        if ($status -match 'token["\s:]+([^\s",}]+)') {
            $kiloToken = $matches[1]
        }
    } catch { }
}

$needLogin = $false
if (-not $opencodeToken) {
    Write-Warning "No OpenCode authentication token found"
    $needLogin = $true
}
if (-not $kiloToken) {
    Write-Warning "No Kilo Code authentication token found"
    $needLogin = $true
}

if ($needLogin) {
    if (Prompt-YesNo "No active login found for OpenCode/Kilo Code. Would you like to log in now?") {
        Write-Step "3a" "Initiating interactive login..."
        
        if (-not $opencodeToken) {
            Write-Info "Opening OpenCode login..."
            opencode auth login
            # Re-check after login
            foreach ($path in $opencodeAuthPaths) {
                if (Test-Path $path) {
                    try {
                        $auth = Get-Content $path -Raw | ConvertFrom-Json
                        if ($auth.token) { $opencodeToken = $auth.token; break }
                        if ($auth.access_token) { $opencodeToken = $auth.access_token; break }
                    } catch { }
                }
            }
        }
        
        if (-not $kiloToken) {
            Write-Info "Opening Kilo Code login..."
            kilo auth login
            # Re-check after login
            foreach ($path in $kiloAuthPaths) {
                if (Test-Path $path) {
                    try {
                        $auth = Get-Content $path -Raw | ConvertFrom-Json
                        if ($auth.token) { $kiloToken = $auth.token; break }
                        if ($auth.access_token) { $kiloToken = $auth.access_token; break }
                    } catch { }
                }
            }
        }
    } else {
        Write-Info "Skipping authentication. Some features may not work."
    }
}

# Save tokens to keys.json
if ($opencodeToken -or $kiloToken) {
    if (-not (Test-Path $codejetDir)) {
        New-Item -ItemType Directory -Path $codejetDir -Force | Out-Null
    }
    
    $kiloValue = if ($kiloToken) { $kiloToken } else { "" }
    $opencodeValue = if ($opencodeToken) { $opencodeToken } else { "" }
    $keys = @{
        kilo_token = $kiloValue
        opencode_token = $opencodeValue
    } | ConvertTo-Json -Depth 3
    
    Set-Content -Path $keysPath -Value $keys -Encoding UTF8
    Write-Success "Authentication tokens saved to $keysPath"
}

# ─── Step 4: Repository & Dependency Setup ───
Write-Step "4/5" "Setting up CodeJet repository..."

$repoUrl = "https://github.com/itarqos5/codejet.git"
$targetDir = $codejetDir

if (Test-Path $targetDir) {
    Write-Info "Repository exists, pulling latest changes..."
    Set-Location $targetDir
    Show-ProgressBar "Pulling changes" 0
    git pull origin main 2>$null | Out-Null
    Show-ProgressBar "Pulling changes" 100
} else {
    Write-Info "Cloning repository..."
    Show-ProgressBar "Cloning" 0
    git clone $repoUrl $targetDir 2>$null | Out-Null
    Show-ProgressBar "Cloning" 100
}

Set-Location $targetDir

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

# ─── Step 5: Completion ───
Write-Step "5/5" "Installation complete!"

Write-Host ""
Write-Banner "🎉 CodeJet installed successfully!"
Write-Host ($AnsiGreen + "  Run 'codejet' to use the CLI tool!" + $AnsiReset)
Write-Host ($AnsiDim + "  Note: Restart your terminal for PATH changes to take effect." + $AnsiReset)
Write-Host ""

# ─── End ───