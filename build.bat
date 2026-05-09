@echo off
echo ============================================
echo   Skip Silence - Build Script
echo ============================================
echo.

where bun >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] bun not found. Install from https://bun.sh/
    pause
    exit /b 1
)

:menu
echo.
echo Select build target:
echo   1. Chrome MV3 (default)
echo   2. Chrome MV2
echo   3. Firefox
echo   4. All
echo.

set /p choice="Enter number (1-4) [default: 1]: "

if "%choice%"=="" set choice=1

if "%choice%"=="1" goto :build_mv3
if "%choice%"=="2" goto :build_mv2
if "%choice%"=="3" goto :build_firefox
if "%choice%"=="4" goto :build_all

echo [ERROR] Invalid choice.
pause
exit /b 1

 

:build_mv3
echo.
echo [BUILD] Building for Chrome MV3...
set PARCEL_WORKERS=0
bun run build
goto :result

:build_mv2
echo.
echo [BUILD] Building for Chrome MV2...
set PARCEL_WORKERS=0
bun run build:mv2
goto :result

:build_firefox
echo.
echo [BUILD] Building for Firefox...
set PARCEL_WORKERS=0
bun run build:firefox
goto :result

:build_all
echo.
echo [BUILD] Building for Chrome MV3...
set PARCEL_WORKERS=0
bun run build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Chrome MV3 build failed.
    pause
    exit /b 1
)
echo.
echo [BUILD] Building for Chrome MV2...
call bun run build:mv2
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Chrome MV2 build failed.
    pause
    exit /b 1
)
echo.
echo [BUILD] Building for Firefox...
call bun run build:firefox
goto :result

:result
if %ERRORLEVEL% equ 0 (
    echo.
    echo ============================================
    echo   Build complete!
    echo   Output: build directory
    echo ============================================
) else (
    echo.
    echo [ERROR] Build failed.
)

pause
