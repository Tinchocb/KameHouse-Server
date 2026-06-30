<#
.SYNOPSIS
    Builds, signs, and optionally installs the KameHouseTV Tizen widget.
.DESCRIPTION
    Packages the KameHouseTV app as a .wgt file using the Tizen CLI,
    signs it with the configured certificate profile, and optionally
    installs it on a Samsung TV via SDB.
.PARAMETER Profile
    Tizen signing profile name (default: kamecert).
.PARAMETER TvIp
    TV IP address for SDB install. If omitted, skips installation.
.PARAMETER OutputDir
    Output directory for the .wgt file (default: current directory).
.PARAMETER NoSign
    Skip signing step (useful for testing).
.EXAMPLE
    .\build.ps1
    Builds and signs KameHouseTV.wgt in the current directory.
.EXAMPLE
    .\build.ps1 -TvIp 192.168.1.50
    Builds, signs, and installs on the TV at 192.168.1.50.
.EXAMPLE
    .\build.ps1 -NoSign -OutputDir C:\temp
    Builds without signing, outputs to C:\temp.
#>

param(
    [string]$Profile = "kamecert",
    [string]$TvIp = "",
    [string]$OutputDir = "",
    [switch]$NoSign
)

$ErrorActionPreference = "Stop"

# --- Paths ---
$TizenCLI = "C:\tizen-studio\tools\ide\bin\tizen.bat"
$SDB = "C:\tizen-studio\tools\sdb.exe"
$ProjectDir = Split-Path -Parent $PSCommandPath
if (-not $OutputDir) { $OutputDir = $ProjectDir }

# --- Ensure Tizen CLI exists ---
if (-not (Test-Path $TizenCLI)) {
    Write-Error "Tizen CLI no encontrado en $TizenCLI. Verificá que Tizen Studio esté instalado."
    exit 1
}

Write-Host "=== KameHouseTV Build Script ===" -ForegroundColor Cyan
Write-Host "Perfil de firma : $Profile"
Write-Host "Proyecto        : $ProjectDir"
Write-Host "Salida          : $OutputDir"
Write-Host ""

# --- Step 1: Clean previous build artifacts ---
Write-Host "[1/3] Limpiando builds anteriores..." -ForegroundColor Yellow
Remove-Item -Path "$ProjectDir\*.wgt" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$ProjectDir\.manifest.tmp" -Force -ErrorAction SilentlyContinue
Write-Host "  OK" -ForegroundColor Green

# --- Step 2: Package the widget ---
Write-Host "[2/3] Empaquetando widget..." -ForegroundColor Yellow

$StagingDir = Join-Path $ProjectDir ".staging"
if (Test-Path $StagingDir) {
    Remove-Item -Path $StagingDir -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Path $StagingDir -Force | Out-Null

# Copy only the necessary files for the TV application
Copy-Item -Path (Join-Path $ProjectDir "index.html") -Destination $StagingDir
Copy-Item -Path (Join-Path $ProjectDir "icon.png") -Destination $StagingDir
Copy-Item -Path (Join-Path $ProjectDir "config.xml") -Destination $StagingDir

$pkgArgs = @(
    "package"
    "-t", "wgt"
    "--", $StagingDir
)
if (-not $NoSign) {
    $pkgArgs = @(
        "package"
        "-t", "wgt"
        "-s", $Profile
        "--", $StagingDir
    )
}

& $TizenCLI $pkgArgs 2>&1
$buildExitCode = $LASTEXITCODE

# Find the generated .wgt file in the parent directory (Tizen CLI generates .wgt in the parent of the input directory)
$wgtFile = Get-ChildItem -Path "$ProjectDir\*.wgt" -ErrorAction SilentlyContinue | Select-Object -First 1

# Clean staging directory
Remove-Item -Path $StagingDir -Recurse -Force -ErrorAction SilentlyContinue

if ($buildExitCode -ne 0) {
    Write-Error "Error al empaquetar el widget."
    exit 1
}

Write-Host "  OK" -ForegroundColor Green

# --- Normalize .wgt filename (remove spaces, use consistent name) ---
if (-not $wgtFile) {
    Write-Error "No se generó el archivo .wgt."
    exit 1
}
$expectedName = "KameHouseTV.wgt"
if ($wgtFile.Name -ne $expectedName) {
    $normalized = Join-Path $wgtFile.DirectoryName $expectedName
    Move-Item -Path $wgtFile.FullName -Destination $normalized -Force
    $wgtFile = Get-Item $normalized
    Write-Host "  Normalizado: $expectedName" -ForegroundColor Gray
}
if ($OutputDir -ne $ProjectDir) {
    $dest = Join-Path $OutputDir $expectedName
    Move-Item -Path $wgtFile.FullName -Destination $dest -Force
    $wgtFile = Get-Item $dest
    Write-Host "  Movido a: $dest" -ForegroundColor Gray
}

Write-Host "  Widget generado: $($wgtFile.FullName)" -ForegroundColor Green

# --- Step 3: Install on TV (optional) ---
if ($TvIp) {
    Write-Host "[3/3] Instalando en TV ($TvIp)..." -ForegroundColor Yellow

    # Connect SDB to TV
    & $SDB connect $TvIp 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "No se pudo conectar a la TV en $TvIp. Verificá que esté en modo desarrollador."
        exit 1
    }

    # Install the widget
    & $SDB install $wgtFile.FullName 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Error al instalar el widget en la TV."
        & $SDB disconnect 2>&1 | Out-Null
        exit 1
    }

    & $SDB disconnect 2>&1 | Out-Null
    Write-Host "  App instalada correctamente en $TvIp" -ForegroundColor Green
} else {
    Write-Host "[3/3] Saltando instalación (usá -TvIp para instalar automáticamente)." -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Build completado ===" -ForegroundColor Cyan
