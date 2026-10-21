$ErrorActionPreference = 'Stop'
$toolsDir = Join-Path (Split-Path $PSScriptRoot -Parent) '.tools'
$stateFile = Join-Path $toolsDir 'processes.json'
if (Test-Path $stateFile) {
    foreach ($entry in @(Get-Content $stateFile -Raw | ConvertFrom-Json)) {
        $process = Get-Process -Id $entry.id -ErrorAction SilentlyContinue
        if ($process -and $process.StartTime.ToUniversalTime().Ticks -eq ([datetime]$entry.started).ToUniversalTime().Ticks) {
            Stop-Process -Id $entry.id
            $process.WaitForExit()
            Write-Host "Parado: $($entry.name)"
        }
    }
    Remove-Item -LiteralPath $stateFile
}
$pgData = Join-Path $toolsDir 'pgdata'
if (Test-Path (Join-Path $pgData 'postmaster.pid')) {
    & (Join-Path $toolsDir 'pgsql/bin/pg_ctl.exe') stop -D $pgData -m fast -w
}
Write-Host 'Serviços parados. Dados preservados.'
