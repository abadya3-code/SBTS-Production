$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".git")) {
  throw "Git metadata is missing. Do not publish from an extracted ZIP. Copy these files into the real SBTS-Production clone first."
}

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  throw "pnpm is not available. Install Node.js 22 with Corepack, then run: corepack enable"
}

Write-Host "Installing the exact locked dependencies..." -ForegroundColor Cyan
pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed. Nothing was committed or pushed." }

Write-Host "Running the full release gate before staging files..." -ForegroundColor Cyan
pnpm publish:check
if ($LASTEXITCODE -ne 0) { throw "Release verification failed. Nothing was committed or pushed." }

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

pnpm publish:verify
if ($LASTEXITCODE -ne 0) { throw "The push completed, but local HEAD could not be verified against origin/main." }

$head = git rev-parse HEAD
Write-Host "Update pushed to GitHub. Railway Auto Deploy should start automatically." -ForegroundColor Green
Write-Host "Published commit: $head" -ForegroundColor Green
Write-Host "After Railway reports Success, run:" -ForegroundColor Cyan
Write-Host "  pnpm deploy:verify -- https://YOUR-SERVICE.up.railway.app" -ForegroundColor White
