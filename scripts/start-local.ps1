$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$toolsDir = Join-Path $projectRoot '.tools'
$runtimeFile = Join-Path $toolsDir 'runtimes.json'
if (!(Test-Path $runtimeFile)) { throw 'Runtimes locais ausentes. Use a instalação local preparada ou Docker Compose.' }
$runtime = Get-Content $runtimeFile -Raw | ConvertFrom-Json
$php = Join-Path $toolsDir 'php/php.exe'
$pgBin = Join-Path $toolsDir 'pgsql/bin'
$pgData = Join-Path $toolsDir 'pgdata'
$stateFile = Join-Path $toolsDir 'processes.json'
if (Test-Path $stateFile) {
    $previous = @(Get-Content $stateFile -Raw | ConvertFrom-Json)
    foreach ($entry in $previous) {
        $process = Get-Process -Id $entry.id -ErrorAction SilentlyContinue
        if ($process -and $process.StartTime.ToUniversalTime().Ticks -eq ([datetime]$entry.started).ToUniversalTime().Ticks) {
            throw 'O sistema já está em execução. Use scripts/stop-local.ps1 antes de reiniciar.'
        }
    }
}
foreach ($port in @(3001, 8000, 8001)) {
    if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) {
        throw "A porta $port já está ocupada. Pare a execução anterior antes de iniciar."
    }
}
foreach ($line in Get-Content (Join-Path $projectRoot '.env')) {
    if ($line -match '^([A-Z_]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process') }
}
$env:PGPASSWORD = $env:POSTGRES_PASSWORD
$env:DATABASE_URL = "postgresql://todo:$($env:POSTGRES_PASSWORD)@127.0.0.1:55432/todo"
$env:LOGS_URL = 'http://127.0.0.1:8000'
$env:ANALYZER_URL = 'http://127.0.0.1:8001'
$env:PUBLIC_DIR = Join-Path $projectRoot 'frontend'
$env:BIND_HOST = '127.0.0.1'
$env:PYTHONPATH = Join-Path $toolsDir 'python-libs'
if (!(Test-Path (Join-Path $pgData 'PG_VERSION'))) {
    $passwordFile = Join-Path $toolsDir 'pg-password.tmp'
    [IO.File]::WriteAllText($passwordFile, $env:POSTGRES_PASSWORD, [Text.UTF8Encoding]::new($false))
    try {
        & "$pgBin/initdb.exe" -D $pgData -U todo --auth=scram-sha-256 --encoding=UTF8 --locale=C "--pwfile=$passwordFile"
        if ($LASTEXITCODE -ne 0) { throw 'Falha ao inicializar PostgreSQL' }
    } finally { Remove-Item -LiteralPath $passwordFile -Force }
}
& "$pgBin/pg_ctl.exe" status -D $pgData 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    & "$pgBin/pg_ctl.exe" start -D $pgData -l (Join-Path $toolsDir 'postgres.log') -o '-p 55432 -h 127.0.0.1' -w
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao iniciar PostgreSQL' }
}
if (!(Test-Path (Join-Path $toolsDir 'database-created'))) {
    & "$pgBin/createdb.exe" -h 127.0.0.1 -p 55432 -U todo todo
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao criar banco todo' }
    New-Item -ItemType File (Join-Path $toolsDir 'database-created') | Out-Null
}
Push-Location (Join-Path $projectRoot 'services/api')
try {
    & $runtime.node 'node_modules/prisma/build/index.js' db push --skip-generate
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao preparar schema Prisma' }
} finally { Pop-Location }
& $php (Join-Path $projectRoot 'services/logs/init.php')
if ($LASTEXITCODE -ne 0) { throw 'Falha ao preparar Eloquent' }
$started = @()
function Start-ServiceProcess($name, $exe, $arguments, $directory) {
    $process = Start-Process -FilePath $exe -ArgumentList $arguments -WorkingDirectory $directory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $toolsDir "$name.out.log") -RedirectStandardError (Join-Path $toolsDir "$name.err.log")
    return @{ name = $name; id = $process.Id; started = $process.StartTime.ToUniversalTime().ToString('o') }
}
try {
    $started += Start-ServiceProcess 'logs' $php @('-S','127.0.0.1:8000','router.php') (Join-Path $projectRoot 'services/logs')
    $apiDatabaseUrl = $env:DATABASE_URL
    $env:DATABASE_URL = $env:DATABASE_URL.Replace('postgresql://', 'postgresql+psycopg://')
    $started += Start-ServiceProcess 'analyzer' $runtime.python @('-m','uvicorn','app:app','--host','127.0.0.1','--port','8001') (Join-Path $projectRoot 'services/analyzer')
    $env:DATABASE_URL = $apiDatabaseUrl
    $started += Start-ServiceProcess 'api' $runtime.node @('src/server.js') (Join-Path $projectRoot 'services/api')
} finally { $started | ConvertTo-Json | Set-Content $stateFile }
Start-Sleep -Milliseconds 500
foreach ($entry in $started) {
    if (!(Get-Process -Id $entry.id -ErrorAction SilentlyContinue)) { throw "O serviço $($entry.name) encerrou. Consulte .tools/$($entry.name).err.log." }
}
foreach ($url in @('http://127.0.0.1:3001/', 'http://127.0.0.1:8000/api/logs', 'http://127.0.0.1:8001/api/stats')) {
    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) { $ready = $true; break }
        } catch {
            if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 401) { $ready = $true; break }
        }
        Start-Sleep -Milliseconds 250
    }
    if (!$ready) { throw "Serviço indisponível: $url. Consulte .tools/*.err.log e pare os processos com scripts/stop-local.ps1." }
}
Write-Host 'Sistema iniciado: http://localhost:3001'
Write-Host 'Logs de execução na pasta .tools. Para parar: scripts/stop-local.ps1'
