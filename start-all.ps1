$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$mongoPath = 'C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe'
$redisPath = 'C:\Program Files\Redis\redis-server.exe'
$nodePath = (Get-Command node.exe -ErrorAction Stop).Source
$tsxCli = Join-Path $repoRoot 'node_modules/tsx/dist/cli.mjs'
$apiEntry = Join-Path $repoRoot 'api/src/index.ts'
$workerEntry = Join-Path $repoRoot 'worker/src/index.ts'
$frontendDir = Join-Path $repoRoot 'frontend'
$frontendCli = Join-Path $repoRoot 'node_modules/vite/bin/vite.js'

New-Item -ItemType Directory -Force -Path 'C:\data\db' | Out-Null

if (-not (Get-NetTCPConnection -LocalPort 27017 -ErrorAction SilentlyContinue)) {
  Start-Process -FilePath $mongoPath -ArgumentList '--dbpath', 'C:\data\db' -WindowStyle Hidden | Out-Null
}

if (-not (Get-NetTCPConnection -LocalPort 6379 -ErrorAction SilentlyContinue)) {
  Start-Process -FilePath $redisPath -WindowStyle Hidden | Out-Null
}

if (-not (Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue)) {
  Start-Process -FilePath $nodePath -ArgumentList $tsxCli, $apiEntry -WorkingDirectory (Join-Path $repoRoot 'api') -WindowStyle Hidden | Out-Null
}

if (-not (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue)) {
  Start-Process -FilePath $nodePath -ArgumentList $tsxCli, $workerEntry -WorkingDirectory (Join-Path $repoRoot 'worker') -WindowStyle Hidden | Out-Null
}

if (-not (Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue)) {
  Start-Process -FilePath $nodePath -ArgumentList $frontendCli, '--host', '0.0.0.0' -WorkingDirectory $frontendDir -WindowStyle Hidden | Out-Null
}

Start-Sleep -Seconds 5

Write-Host 'All services started.'
Write-Host 'API: http://127.0.0.1:4000'
Write-Host 'Worker: background process'
Write-Host 'Frontend: http://127.0.0.1:5173'
