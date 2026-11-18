@echo off
setlocal enabledelayedexpansion
title KameHouse Desktop (Dev)
cd /d "%~dp0"

:: Resolve la raíz del repo una vez para usarla en start sin quoting anidado
set "REPO_ROOT=%~dp0"
:: Quitar barra final si existe
if "%REPO_ROOT:~-1%"=="\" set "REPO_ROOT=%REPO_ROOT:~0,-1%"


:: El arranque usa una única ventana principal en Tauri (sin splash de navegador previo).

echo.
echo  ========================================================
echo    KameHouse Desktop - Desarrollo
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
:: 1c. Verificar dependencias (node_modules)
:: ---------------------------------------------------------
set "INSTALL_DEPS="
if not exist "node_modules\.bin\concurrently.CMD" (
    set "INSTALL_DEPS=1"
)
if not exist "apps\desktop\node_modules\.bin\tauri.CMD" if not exist "node_modules\.bin\tauri.CMD" set "INSTALL_DEPS=1"
if not exist "apps\web\node_modules\.bin\rsbuild.CMD" if not exist "node_modules\.bin\rsbuild.CMD" set "INSTALL_DEPS=1"
if defined INSTALL_DEPS (
    echo  [INFO] Dependencias no encontradas o incompletas. Instalando con pnpm...
    call pnpm install
    if !ERRORLEVEL! NEQ 0 (
        echo  [ERROR] Fallo al instalar dependencias con pnpm.
        pause
        exit /b 1
    )
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

:: Si :43210 ya lo ocupa un servidor Rsbuild DEV de ESTE repo escuchando solo en 127.0.0.1 (por
:: ejemplo, lo levantaste en otra terminal), Tauri lo reutiliza: no se levanta ni se mata nada.
:: Cualquier otra cosa en ese puerto se cierra como antes -incluido un servidor expuesto a la LAN-:
:: un servidor viejo se queda sirviendo la interfaz de una sesion anterior y el nuevo falla por
:: puerto ocupado -strictPort-. Solo se cierra si el proceso es node.exe, para no matar otra cosa
:: que use ese puerto.
:: La reutilizacion exige la raiz del repo seguida de node_modules o apps\web: un worktree
:: (.claude\worktrees\...) o un repo vecino con nombre parecido no cuenta.
set "REUSE_WEB=0"
for /f "tokens=2,5" %%a in ('netstat -ano ^| findstr ":43210.*LISTENING" 2^>nul') do (
    if %%b NEQ 0 (
        set "LOCAL_ADDR=%%a"
        set "REUSE_OK=0"
        powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = Get-CimInstance Win32_Process -Filter 'ProcessId = %%b' -ErrorAction SilentlyContinue; $c = [string]$p.CommandLine; $ours = $c -like '*rsbuild*' -and ($c -like ('*' + $env:REPO_ROOT + '\node_modules\*') -or $c -like ('*' + $env:REPO_ROOT + '\apps\web\*')) -and $c -match 'dev\W*$'; if ($ours) { exit 0 } else { exit 1 }" >nul 2>&1
        if !ERRORLEVEL! EQU 0 if "!LOCAL_ADDR:~0,10!"=="127.0.0.1:" set "REUSE_OK=1"
        if "!REUSE_OK!"=="1" (
            echo  [INFO] Reutilizando el servidor de desarrollo activo en :43210 - PID %%b
            echo  [AVISO] Ese servidor conserva la configuracion con la que se inicio: puerto del backend, .env.web y rsbuild.config.ts. Si Tauri muestra 503 o cambios viejos, cierre ese servidor y vuelva a ejecutar este script.
            set "REUSE_WEB=1"
        ) else (
            tasklist /FI "PID eq %%b" /FO CSV /NH 2>nul | findstr /i "node.exe" >nul && (
                echo  [INFO] Cerrando el servidor de desarrollo anterior en :43210 - PID %%b
                taskkill /F /T /PID %%b >nul 2>&1
            )
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
echo  La ventana aparece cuando termina la compilacion de Rust.
echo  El servidor Go compila en fondo y se conecta solo.
echo.

:: Con el servidor reutilizado solo se lanza Tauri: pnpm dev:desktop levantaria otro Rsbuild en
:: :43210 (strictPort) y concurrently -k cerraria todo al fallar.
if "%REUSE_WEB%"=="1" (
    call pnpm --filter kamehouse-desktop dev
) else (
    call pnpm dev:desktop
)
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
