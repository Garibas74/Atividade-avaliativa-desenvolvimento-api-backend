$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $projectRoot '.env'
if (Test-Path -LiteralPath $envFile) {
    Write-Host '.env já existe; configuração preservada.'
    exit 0
}
function New-Secret {
    $bytes = New-Object byte[] 32
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $generator.GetBytes($bytes)
    $generator.Dispose()
    return -join ($bytes | ForEach-Object { $_.ToString('x2') })
}
$content = @(
    "POSTGRES_PASSWORD=$(New-Secret)"
    "JWT_SECRET=$(New-Secret)"
    "SERVICE_TOKEN=$(New-Secret)"
) -join "`n"
[System.IO.File]::WriteAllText($envFile, $content + "`n", [System.Text.UTF8Encoding]::new($false))
Write-Host '.env criado com segredos aleatórios.'
