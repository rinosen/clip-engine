Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  AutoClipper AI - Starting FastAPI Backend Server" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$env:PYTHONPATH = "$PSScriptRoot"
$localVenv = "$PSScriptRoot\venv\Scripts\python.exe"
$openshortsVenv = "$PSScriptRoot\..\openshorts\venv\Scripts\python.exe"

if (Test-Path $localVenv) {
    & $localVenv -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
} elseif (Test-Path $openshortsVenv) {
    & $openshortsVenv -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
} else {
    python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
}

