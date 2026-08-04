<#
.SYNOPSIS
    Step 3: Extract and save authentication tokens.
.DESCRIPTION
    Reads OpenCode and Kilo Code auth tokens from known paths,
    saves them to ~/.codejet/keys.json. Prompts for interactive
    login if tokens are not found.
.NOTES
    Author: Itarqos
    Version: 1.3.0
#>

$ErrorActionPreference = "Stop"

# Dot-source utilities
. "$PSScriptRoot\utils.ps1"

# --- Token Helpers ---
function Get-ProviderToken {
    param($Auth, [string]$Provider, [string[]]$Keys)
    if ($null -eq $Auth) { return $null }
    $entry = $Auth.PSObject.Properties[$Provider]
    if ($null -eq $entry -or $null -eq $entry.Value) { return $null }
    foreach ($keyName in $Keys) {
        $val = $entry.Value.PSObject.Properties[$keyName]
        if ($null -ne $val -and $null -ne $val.Value -and [string]$val.Value -ne "") {
            return [string]$val.Value
        }
    }
    return $null
}

function Read-OpencodeToken {
    param($Auth)
    return Get-ProviderToken $Auth "opencode" @("key", "access", "token")
}

function Read-KiloToken {
    param($Auth)
    return Get-ProviderToken $Auth "kilo" @("access", "token", "key")
}

# --- Main ---
Write-Step "3/5" "Checking authentication tokens..."

$codejetDir = "$env:USERPROFILE\.codejet"
$keysPath = "$codejetDir\keys.json"

$opencodeAuthPaths = @(
    "$env:USERPROFILE\.local\share\opencode\auth.json",
    "$env:LOCALAPPDATA\opencode\auth.json",
    "$env:HOME\.local\share\opencode\auth.json"
)

$kiloAuthPaths = @(
    "$env:USERPROFILE\.local\share\kilo\auth.json",
    "$env:HOME\.local\share\kilo\auth.json",
    "$env:APPDATA\kilo\auth.json",
    "$env:LOCALAPPDATA\kilo\auth.json"
)

$opencodeToken = $null
$kiloToken = $null

# Check OpenCode auth (reads the "opencode" provider, never "opencode-go")
foreach ($path in $opencodeAuthPaths) {
    if (Test-Path $path) {
        try {
            $auth = Get-Content $path -Raw | ConvertFrom-Json
            $token = Read-OpencodeToken $auth
            if ($token) { $opencodeToken = $token; break }
        } catch { }
    }
}

# Check Kilo Code auth
foreach ($path in $kiloAuthPaths) {
    if (Test-Path $path) {
        try {
            $auth = Get-Content $path -Raw | ConvertFrom-Json
            $token = Read-KiloToken $auth
            if ($token) { $kiloToken = $token; break }
        } catch { }
    }
}

# Try kilo auth status command as fallback
if (-not $kiloToken -and (Check-Command "kilo")) {
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
            foreach ($path in $opencodeAuthPaths) {
                if (Test-Path $path) {
                    try {
                        $auth = Get-Content $path -Raw | ConvertFrom-Json
                        $token = Read-OpencodeToken $auth
                        if ($token) { $opencodeToken = $token; break }
                    } catch { }
                }
            }
        }

        if (-not $kiloToken) {
            Write-Info "Opening Kilo Code login..."
            kilo auth login
            foreach ($path in $kiloAuthPaths) {
                if (Test-Path $path) {
                    try {
                        $auth = Get-Content $path -Raw | ConvertFrom-Json
                        $token = Read-KiloToken $auth
                        if ($token) { $kiloToken = $token; break }
                    } catch { }
                }
            }
        }
    } else {
        Write-Info "Skipping authentication. Some features may not work."
    }
}

if ($opencodeToken) { Write-Success "OpenCode authentication token found" }
if ($kiloToken) { Write-Success "Kilo Code authentication token found" }

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
