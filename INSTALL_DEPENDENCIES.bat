@echo off
REM TicketHub Backend - Dependencies Installation Script (Windows)
REM This script installs all required dependencies for the backend

echo.
echo ==========================================
echo TicketHub Backend - Dependencies Setup
echo ==========================================
echo.

REM Check if npm is installed
npm --version >nul 2>&1
if errorlevel 1 (
    echo X npm is not installed. Please install Node.js and npm first.
    pause
    exit /b 1
)

echo + npm found: 
npm --version
echo.

echo Downloading and installing dependencies...
echo.

REM Install all dependencies
call npm install

if errorlevel 1 (
    echo.
    echo X Installation failed. Please check the error messages above.
    pause
    exit /b 1
) else (
    echo.
    echo + Dependencies installed successfully!
    echo.
    echo Installed packages:
    call npm list --depth=0
    echo.
    echo Next steps:
    echo 1. Configure .env file with Supabase credentials
    echo 2. Run 'npm start' to start the server
    echo 3. Run 'npm run dev' for development mode
    echo.
    pause
)
