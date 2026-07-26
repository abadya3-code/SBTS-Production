$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".git")) {
  throw "Git metadata is missing. Run 01_CONNECT_GITHUB_ONCE.cmd first or open the existing Git clone."
}

$branch = git branch --show-current
if ($branch -ne "main") {
  git checkout main
}

git add -A
$staged = git diff --cached --name-only
if (-not $staged) {
  Write-Host "No local changes to publish." -ForegroundColor Yellow
  git status
  exit 0
}

$message = Read-Host "Write the update description"
if ([string]::IsNullOrWhiteSpace($message)) {
  $message = "Update SBTS application"
}

git commit -m $message
if ($LASTEXITCODE -ne 0) { throw "Git commit failed." }

git pull --rebase origin main
if ($LASTEXITCODE -ne 0) { throw "Git pull/rebase failed. Resolve the shown conflict before pushing." }

git push origin main
if ($LASTEXITCODE -ne 0) { throw "Git push failed." }

Write-Host "Update pushed to GitHub. Railway Auto Deploy should start automatically." -ForegroundColor Green
