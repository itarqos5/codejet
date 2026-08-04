<#
.SYNOPSIS
    Step 5: Display installation complete message.
.DESCRIPTION
    Shows the final success banner and instructions after
    a successful CodeJet installation.
.NOTES
    Author: Itarqos
    Version: 1.3.0
#>

# Dot-source utilities
. "$PSScriptRoot\utils.ps1"

Write-Step "5/5" "Installation complete!"

Write-Host ""
Write-Banner "CodeJet installed successfully!"
Write-Host ($script:AnsiGreen + "  Run 'codejet' to use the CLI tool!" + $script:AnsiReset)
Write-Host ($script:AnsiDim + "  Note: Restart your terminal for PATH changes to take effect." + $script:AnsiReset)
Write-Host ""
