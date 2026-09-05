# Pack join-platform as SSE Deploy zip -> join-platform-sseinfra.zip
# Usage: powershell -ExecutionPolicy Bypass -File .\deploy\pack-sseinfra.ps1
# Prebuilds server/web dist so Pod can start without running tsc/vite.
# 敏感值（环境变量）一律由部署平台注入，不落包。

$ErrorActionPreference = 'Stop'

$deployDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $deployDir
$zip = Join-Path $repoRoot 'join-platform-sseinfra.zip'
$stage = Join-Path $repoRoot '.pack-sseinfra-stage'

function Copy-Tree {
    param([string]$Src, [string]$Dst, [string[]]$ExcludeNames, [string[]]$ExcludeRegex)
    New-Item -ItemType Directory -Force -Path $Dst | Out-Null
    $items = @(Get-ChildItem -LiteralPath $Src -Force)
    foreach ($it in $items) {
        $skip = $false
        if ($ExcludeNames -contains $it.Name) { $skip = $true }
        if (-not $skip) {
            foreach ($pat in $ExcludeRegex) {
                if ($it.Name -match $pat) { $skip = $true; break }
            }
        }
        if (-not $skip) {
            Copy-Item -LiteralPath $it.FullName -Destination $Dst -Recurse -Force
        }
    }
}

function Assert-HasFile {
    param([string]$Path, [string]$Hint)
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "pack assert failed: missing $Path ($Hint)"
    }
}

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path $stage | Out-Null

try {
    Write-Host 'Prebuilding server + web...'

    Push-Location (Join-Path $repoRoot 'server')
    try {
        if (-not (Test-Path 'node_modules')) { npm ci --include=dev }
        npm run build
        Assert-HasFile (Join-Path (Get-Location) 'dist\index.js') 'server tsc'
    } finally { Pop-Location }

    Push-Location (Join-Path $repoRoot 'web')
    try {
        $env:VITE_BASE_PATH = '/'
        $env:VITE_API_BASE = ''
        if (-not (Test-Path 'node_modules')) { npm ci --include=dev }
        npm run build
        Assert-HasFile (Join-Path (Get-Location) 'dist\index.html') 'web vite'
    } finally {
        Remove-Item Env:VITE_BASE_PATH -ErrorAction SilentlyContinue
        Remove-Item Env:VITE_API_BASE -ErrorAction SilentlyContinue
        Pop-Location
    }

    Write-Host 'Staging join-platform...'

    $shSrc = Join-Path $repoRoot 'deploy.sh'
    $deployShText = [System.IO.File]::ReadAllText($shSrc) -replace "`r`n", "`n" -replace "`r", "`n"
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText((Join-Path $stage 'deploy.sh'), $deployShText, $utf8NoBom)

    Copy-Item -LiteralPath (Join-Path $repoRoot 'README.md') -Destination (Join-Path $stage 'README.md') -Force

    $serverEx = @('node_modules', 'data', '.env', '.npm-cache', '.npm')
    Copy-Tree -Src (Join-Path $repoRoot 'server') -Dst (Join-Path $stage 'server') -ExcludeNames $serverEx -ExcludeRegex @('\.log$')
    Assert-HasFile (Join-Path $stage 'server\src\index.ts') 'server source'
    Assert-HasFile (Join-Path $stage 'server\dist\index.js') 'server dist'

    $webEx = @('node_modules', '.env', '.npm-cache', '.npm')
    Copy-Tree -Src (Join-Path $repoRoot 'web') -Dst (Join-Path $stage 'web') -ExcludeNames $webEx -ExcludeRegex @('\.log$')
    Assert-HasFile (Join-Path $stage 'web\src\main.ts') 'web source'
    Assert-HasFile (Join-Path $stage 'web\dist\index.html') 'web dist'

    if (Test-Path (Join-Path $repoRoot 'docs')) {
        Copy-Tree -Src (Join-Path $repoRoot 'docs') -Dst (Join-Path $stage 'docs') -ExcludeNames @()
    }
    Copy-Item -LiteralPath (Join-Path $repoRoot '.gitignore') -Destination (Join-Path $stage '.gitignore') -Force -ErrorAction SilentlyContinue

    Write-Host 'Compressing...'
    if (Test-Path $zip) { Remove-Item $zip -Force }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory($stage, $zip, [System.IO.Compression.CompressionLevel]::Optimal, $false)

    $z = [IO.Compression.ZipFile]::OpenRead($zip)
    try {
        $names = @($z.Entries | ForEach-Object { ($_.FullName -replace '\\', '/') })
        foreach ($need in @('deploy.sh', 'server/src/index.ts', 'server/dist/index.js', 'web/dist/index.html')) {
            $ok = $false
            foreach ($n in $names) {
                if ($n -eq $need) { $ok = $true; break }
            }
            if (-not $ok) { throw "zip missing $need" }
        }
        $npmCache = @($names | Where-Object { $_ -match 'npm-cache' }).Count
        if ($npmCache -gt 0) { Write-Warning "zip still contains $npmCache npm-cache entries" }
    } finally {
        $z.Dispose()
    }

    $sizeMb = [math]::Round((Get-Item $zip).Length / 1MB, 2)
    Write-Host ("Done: {0} ({1} MB)" -f $zip, $sizeMb) -ForegroundColor Green
    Write-Host 'Contains prebuilt server/dist + web/dist. Deploy as join-platform module (join.ssemarket.cn).'
} finally {
    foreach ($attempt in 1..5) {
        try {
            if (Test-Path $stage) { Remove-Item $stage -Recurse -Force -ErrorAction Stop }
            break
        } catch {
            Start-Sleep -Milliseconds 300
        }
    }
}
