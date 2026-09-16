@echo off
setlocal enabledelayedexpansion
title KameHouse Desktop (Dev)
cd /d "%~dp0"

:: Resolve la raíz del repo una vez para usarla en start sin quoting anidado
set "REPO_ROOT=%~dp0"
:: Quitar barra final si existe
if "%REPO_ROOT:~-1%"=="\" set "REPO_ROOT=%REPO_ROOT:~0,-1%"

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

:: ---------------------------------------------------------
:: 1. Verificar herramientas (paralelo con build Go)
:: ---------------------------------------------------------
where go >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] Go no esta instalado o no esta en el PATH.
    echo          Descargalo de https://go.dev/dl/
    pause
    exit /b 1
)
where pnpm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] pnpm no esta instalado o no esta en el PATH.
    pause
    exit /b 1
)
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] Node.js no esta instalado o no esta en el PATH.
    echo          Descargalo de https://nodejs.org/
    pause
    exit /b 1
)

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
    if "%CI%"=="" pause
)
exit /b %EXIT_CODE%