$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "SBTS 2.2 - connect this clean foundation folder to GitHub" -ForegroundColor Cyan
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git is not installed or not available in PATH."
}

if (-not (Test-Path ".git")) {
  git init -b main
  if ($LASTEXITCODE -ne 0) { throw "git init failed." }
}

if (-not (git config user.name)) {
  git config user.name (Read-Host "Enter your Git name")
}
if (-not (git config user.email)) {
  git config user.email (Read-Host "Enter your GitHub verified email")
}

$defaultRepo = "https://github.com/abadya3-code/SBTS-Production.git"
$repoUrl = Read-Host "GitHub repository URL [$defaultRepo]"
if ([string]::IsNullOrWhiteSpace($repoUrl)) { $repoUrl = $defaultRepo }

$remotes = @(git remote)
if ($LASTEXITCODE -ne 0) { throw "Could not inspect Git remotes." }

if ($remotes -notcontains "origin") {
  git remote add origin $repoUrl
  if ($LASTEXITCODE -ne 0) { throw "Could not add the origin remote." }
} else {
  $origin = git remote get-url origin
  if ($LASTEXITCODE -ne 0) { throw "Could not read the origin remote URL." }
  if ($origin -ne $repoUrl) {
    git remote set-url origin $repoUrl
    if ($LASTEXITCODE -ne 0) { throw "Could not update the origin remote URL." }
  }
}

# Adopt the current remote history when the repository already contains the
# older SBTS release. The clean package remains in the working tree and becomes
# one controlled upgrade commit instead of requiring a force push.
git fetch origin main 2>$null
if ($LASTEXITCODE -eq 0) {
  git reset --mixed origin/main
  if ($LASTEXITCODE -ne 0) { throw "Could not adopt origin/main history." }
} else {
  Write-Host "Remote main is empty or unavailable; creating the first commit." -ForegroundColor Yellow
}

git add -A
$staged = git diff --cached --name-only
if ($staged) {
  git commit -m "Deploy SBTS 2.2 foundation clean release"
  if ($LASTEXITCODE -ne 0) { throw "Git commit failed." }
} else {
  Write-Host "No source differences were found." -ForegroundColor Yellow
}

git branch -M main
git push -u origin main
if ($LASTEXITCODE -ne 0) {
  throw "Push failed. Confirm GitHub access and that branch protection permits the push."
}

Write-Host "GitHub connected successfully. Future updates use 02_PUSH_UPDATE.cmd." -ForegroundColor Green
