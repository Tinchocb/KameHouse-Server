# Splash instantáneo para el arranque en desarrollo (dev-desktop.bat).
#
# En dev, la ventana splash de Tauri recién aparece cuando termina de compilar
# Rust y Rsbuild está levantado. Este script abre apps/web/public/splash.html
# al instante en una ventana liviana (Edge/Chrome/Brave en modo --app, con un
# perfil aislado) y la cierra sola cuando aparece la ventana de Tauri.
#
# Uso:
#   dev-splash.ps1          -> abre el splash y espera a Tauri para cerrarlo
#   dev-splash.ps1 -Close   -> cierra el splash (limpieza / errores)

param(
    [switch]$Close,
    [int]$TimeoutMinutes = 15
)

$ErrorActionPreference = 'SilentlyContinue'

# Marcador único en la línea de comandos: solo cerramos NUESTRA instancia.
$ProfileDir = Join-Path $env:LOCALAPPDATA 'KameHouse\dev-splash-profile'
$TauriProcess = 'kamehouse-desktop'

function Close-Splash {
    Get-CimInstance Win32_Process |
        Where-Object { $_.CommandLine -and $_.CommandLine -like "*$ProfileDir*" } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
}

if ($Close) {
    Close-Splash
    exit 0
}

# Primer navegador Chromium disponible (modo app = ventana sin barra ni pestañas).
$candidates = @(
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe",
    "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\Application\brave.exe"
)
$browser = $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $browser) {
    # Sin navegador compatible: simplemente no hay splash previo.
    exit 0
}

$splashPath = Join-Path $PSScriptRoot '..\apps\web\public\splash.html'
$splashPath = (Resolve-Path $splashPath).Path
$splashUrl = ([System.Uri]$splashPath).AbsoluteUri + '#' + [System.Uri]::EscapeDataString('Compilando entorno de desarrollo...')

# Centrado en el área de trabajo (en DIPs, igual que --window-size).
$w = 460; $h = 380
$x = 200; $y = 200
try {
    Add-Type -AssemblyName PresentationFramework
    $area = [System.Windows.SystemParameters]::WorkArea
    $x = [int]($area.Left + ($area.Width - $w) / 2)
    $y = [int]($area.Top + ($area.Height - $h) / 2)
} catch {}

Close-Splash
Start-Process -FilePath $browser -ArgumentList @(
    "--app=$splashUrl",
    "--user-data-dir=`"$ProfileDir`"",
    "--window-size=$w,$h",
    "--window-position=$x,$y",
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-sync'
)

# Esperar a que Tauri muestre su primera ventana (su propio splash).
$deadline = (Get-Date).AddMinutes($TimeoutMinutes)
while ((Get-Date) -lt $deadline) {
    $tauri = Get-Process -Name $TauriProcess | Where-Object { $_.MainWindowHandle -ne 0 }
    if ($tauri) { break }
    Start-Sleep -Milliseconds 400
}

# Cierre inmediato al aparecer Tauri para evitar solapamiento visible entre ventanas
Start-Sleep -Milliseconds 50
Close-Splash
