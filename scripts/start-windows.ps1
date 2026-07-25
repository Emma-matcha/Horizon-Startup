$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$localUrl = 'http://127.0.0.1:4173/'
Set-Location -LiteralPath $projectRoot

try {
  $node = Get-Command node.exe -ErrorAction SilentlyContinue
  if (-not $node) {
    throw 'Node.js 20.19+ or 22.12+ is required. Download it from https://nodejs.org/'
  }

  $nodeVersion = (& $node.Source --version).TrimStart('v')
  $nodeSemVer = [version]$nodeVersion
  $supportsNode20 = $nodeSemVer -ge [version]'20.19.0' -and $nodeSemVer -lt [version]'21.0.0'
  $supportsNode22Plus = $nodeSemVer -ge [version]'22.12.0'
  if (-not ($supportsNode20 -or $supportsNode22Plus)) {
    throw "Node.js 20.19+ or 22.12+ is required. Current version: $nodeVersion"
  }

  $pnpm = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
  $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($pnpm) {
    $runner = $pnpm.Source
  } elseif ($npm) {
    $runner = $npm.Source
  } else {
    throw 'Neither pnpm nor npm was found in PATH. Reinstall Node.js 20 or newer.'
  }

  $viteCommand = Join-Path $projectRoot 'node_modules\.bin\vite.cmd'
  if (-not (Test-Path -LiteralPath $viteCommand)) {
    Write-Host 'Installing project dependencies...'
    & $runner install
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
  }

  Write-Host 'Building Red House for Windows...'
  & $runner run build
  if ($LASTEXITCODE -ne 0) { throw 'Production build failed.' }

  $voskModel = Join-Path $projectRoot 'public\models\vosk-model-small-cn-0.22.tar'
  if (-not (Test-Path -LiteralPath $voskModel)) {
    throw 'The bundled offline Vosk model is missing.'
  }

  $existingSite = $null
  try {
    $existingSite = Invoke-WebRequest -Uri $localUrl -UseBasicParsing -TimeoutSec 2
  } catch {
    $existingSite = $null
  }

  if ($existingSite) {
    if ($existingSite.Content -match 'Red House Vision') {
      Write-Host "Red House is already running at $localUrl"
      Start-Process $localUrl
      exit 0
    }
    throw 'Port 4173 is already used by another program. Close it and try again.'
  }

  $browserJob = Start-Job -ArgumentList $localUrl -ScriptBlock {
    param($url)
    for ($attempt = 0; $attempt -lt 90; $attempt += 1) {
      try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -eq 200) {
          $chromeCandidates = @(
            (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
            (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe')
          )
          $chrome = $chromeCandidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
          if ($chrome) {
            Start-Process -FilePath $chrome -ArgumentList $url
          } else {
            Start-Process $url
          }
          return
        }
      } catch {
        Start-Sleep -Seconds 1
      }
    }
  }

  Write-Host "Starting Red House at $localUrl"
  Write-Host 'Keep this window open. Press Ctrl+C to stop the local website.'
  try {
    & $runner run start
    if ($LASTEXITCODE -ne 0) { throw 'The local website stopped unexpectedly.' }
  } finally {
    Stop-Job -Job $browserJob -ErrorAction SilentlyContinue
    Remove-Job -Job $browserJob -Force -ErrorAction SilentlyContinue
  }
} catch {
  Write-Host ''
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
