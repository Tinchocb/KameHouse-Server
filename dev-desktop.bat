@echo off
setlocal enabledelayedexpansion
title KameHouse Desktop (Dev)
cd /d "%~dp0"

:: Resolve la raíz del repo una vez para usarla en start sin quoting anidado
set "REPO_ROOT=%~dp0"
:: Quitar barra final si existe
if "%REPO_ROOT:~-1%"=="\" set "REPO_ROOT=%REPO_ROOT:~0,-1%"


:: ---------------------------------------------------------
:: Splash instantaneo: se abre ya (splash.html en ventana app liviana)
:: y se cierra solo cuando aparece la ventana de Tauri. En dev, Tauri
:: no muestra nada hasta terminar de compilar Rust + levantar Rsbuild.
:: ---------------------------------------------------------
if "%CI%"=="" start "" /min powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%REPO_ROOT%\scripts\dev-splash.ps1"

echo.
echo  ========================================================
echo    KameHouse Desktop - Desarrollo (Optimizado)
echo  ========================================================
echo.

:: ---------------------------------------------------------
:: 0. Variables de entorno tempranas
:: ---------------------------------------------------------
set CARGO_INCREMENTAL=1
set RUST_BACKTRACE=1
set KAMEHOUSE_DEV_API_PORT=43212
set KAMEHOUSE_PORT=43212

if not exist "apps\web\.env.web" (
    if exist "apps\web\.env.web.example" (
        echo  [INFO] Generando apps\web\.env.web desde .env.web.example...
        copy "apps\web\.env.web.example" "apps\web\.env.web" >nul
    )
)
if not exist "apps\server\.env" (
    if exist "apps\server\.env.example" (
        copy "apps\server\.env.example" "apps\server\.env" >nul
    )
)

:: ---------------------------------------------------------
:: 1. Verificar herramientas (paralelo con build Go)
:: ---------------------------------------------------------
where go >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] Go no esta instalado o no esta en el PATH.
    echo          Descargalo de https://go.dev/dl/
    call :close_splash
    pause
    exit /b 1
)
where pnpm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] pnpm no esta instalado o no esta en el PATH.
    call :close_splash
    pause
    exit /b 1
)
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] Node.js no esta instalado o no esta en el PATH.
    echo          Descargalo de https://nodejs.org/
    call :close_splash
    pause
    exit /b 1
)

:: ---------------------------------------------------------
:: 1b. Toolchain MSVC para Tauri (rc.exe + link.exe)
:: Si no estan en PATH, buscarlos en las rutas de instalacion
:: (la version cambia con cada update, se resuelve dinamico).
:: ---------------------------------------------------------
where rc.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 goto :msvc_ok
echo  [INFO] rc.exe no esta en PATH, buscando MSVC/Windows SDK instalados...
set "VS_BT_DIR=%ProgramFiles(x86)%\Microsoft Visual Studio\2022\BuildTools"
set "WIN_KITS_DIR=%ProgramFiles(x86)%\Windows Kits\10\bin"
set "MSVC_BIN="
set "WINSDK_BIN="
for /f "delims=" %%d in ('dir /b /ad /o-n "!VS_BT_DIR!\VC\Tools\MSVC\*" 2^>nul') do (
    if not defined MSVC_BIN if exist "!VS_BT_DIR!\VC\Tools\MSVC\%%d\bin\Hostx64\x64\link.exe" set "MSVC_BIN=!VS_BT_DIR!\VC\Tools\MSVC\%%d\bin\Hostx64\x64"
)
for /f "delims=" %%d in ('dir /b /ad /o-n "!WIN_KITS_DIR!\10.*" 2^>nul') do (
    if not defined WINSDK_BIN if exist "!WIN_KITS_DIR!\%%d\x64\rc.exe" set "WINSDK_BIN=!WIN_KITS_DIR!\%%d\x64"
)
if defined MSVC_BIN set "PATH=%MSVC_BIN%;%PATH%"
if defined WINSDK_BIN set "PATH=%WINSDK_BIN%;%PATH%"
where rc.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] Falta el toolchain MSVC -rc.exe/link.exe-. Tauri no puede compilar sin el.
    echo          Instala con: winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --add Microsoft.VisualStudio.Component.Windows11SDK.22621"
    echo          Doc: https://tauri.app/start/prerequisites/
    call :close_splash
    pause
    exit /b 1
)
echo  [INFO] Toolchain MSVC OK.
:msvc_ok

:: ---------------------------------------------------------
:: 2. Limpieza rapida de procesos/puertos huerfanos
:: ---------------------------------------------------------
echo  [1/3] Limpiando entorno...
taskkill /F /IM kamehouse.exe >nul 2>&1
taskkill /F /IM kamehouse-desktop.exe >nul 2>&1
:: Solo matar el sidecar nuestro (valida endpoint), no cualquier proceso en :43212
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":43212.*LISTENING" 2^>nul') do (
    if %%p NEQ 0 (
        :: Verificar que es nuestro sidecar antes de matar
        curl -s -m 2 "http://127.0.0.1:43212/api/v1/status" 2>nul | findstr /i "isDesktopSidecar" >nul && (
            taskkill /F /PID %%p >nul 2>&1
        )
    )
)

:: ---------------------------------------------------------
:: 3. Compilar servidor Go en SEGUNDO PLANO
:: ---------------------------------------------------------
echo  [2/3] Lanzando compilacion del servidor Go en segundo plano...
if not exist "apps\desktop\src-tauri\binaries" mkdir "apps\desktop\src-tauri\binaries"
set GO_BUILD_LOG=%TEMP%\kamehouse-go-build.log
:: La ruta no tiene espacios -> sin comillas internas. Usamos REPO_ROOT sin barra final.
start "KameHouse Go Build" /min cmd /c "node %REPO_ROOT%\scripts\build-server.mjs --dev > "%TEMP%\kamehouse-go-build.log" 2>&1"
echo        (compilando en fondo, log: %GO_BUILD_LOG%)

:: ---------------------------------------------------------
:: 4. Arrancar Web + Desktop en paralelo
:: ---------------------------------------------------------
echo  [3/3] Iniciando entorno (Rsbuild :43210 + Tauri + Sidecar :43212)...
echo.
echo  Tip: El splash aparece al instante.
echo       El servidor Go compila en fondo y se conecta solo.
echo.

call pnpm dev:desktop
set EXIT_CODE=%ERRORLEVEL%

:: ---------------------------------------------------------
:: 5. Limpieza al salir
:: ---------------------------------------------------------
echo.
echo  Limpiando procesos...
call :close_splash
taskkill /F /IM kamehouse.exe >nul 2>&1
taskkill /F /IM kamehouse-desktop.exe >nul 2>&1
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":43212.*LISTENING" 2^>nul') do (
    if %%p NEQ 0 (
        curl -s -m 2 "http://127.0.0.1:43212/api/v1/status" 2>nul | findstr /i "isDesktopSidecar" >nul && (
            taskkill /F /PID %%p >nul 2>&1
        )
    )
)

if %EXIT_CODE% NEQ 0 (
    echo  [ERROR] El proceso termino con codigo: %EXIT_CODE%
    call :close_splash
    if "%CI%"=="" pause
)
exit /b %EXIT_CODE%

:: Cierra el splash de dev (si sigue abierto).
:close_splash
powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\scripts\dev-splash.ps1" -Close >nul 2>&1
exit /b 0
