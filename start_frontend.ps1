Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  AutoClipper AI - Starting Next.js Web Dashboard" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

Set-Location "$PSScriptRoot\frontend"
& npm.cmd run dev

