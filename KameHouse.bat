@echo off
cd /d "d:\Proyectos personales\KameHouse"

:: Check if the compiled executable exists
if exist "apps\desktop\dist\win-unpacked\KameHouse.exe" (
    echo Launching compiled KameHouse Electron app in fullscreen...
    "apps\desktop\dist\win-unpacked\KameHouse.exe" --fullscreen
    exit /b
)

:: If not built, run the development environment
echo Compiled app not found, running Electron in development mode...
cd apps\desktop
npm run dev -- --fullscreen
