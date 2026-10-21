$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$state = Get-Content (Join-Path $projectRoot '.tools/processes.json') -Raw | ConvertFrom-Json
$entry = $state | Where-Object name -eq 'logs'
$process = Get-Process -Id $entry.id -ErrorAction Stop
if ($process.StartTime.ToUniversalTime().Ticks -ne ([datetime]$entry.started).ToUniversalTime().Ticks) { throw 'PID do logger não corresponde à execução registrada' }
$runtime = Get-Content (Join-Path $projectRoot '.tools/runtimes.json') -Raw | ConvertFrom-Json
Push-Location $projectRoot
try {
    Stop-Process -Id $entry.id
    $process.WaitForExit()
    & $runtime.node --env-file=.env tests/log-delivery.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Teste de recuperação de logs falhou' }
} finally {
    & ./scripts/stop-local.ps1
    & ./scripts/start-local.ps1
    Pop-Location
}
