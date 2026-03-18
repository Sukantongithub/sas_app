@echo off
REM ML Service Setup Script for Windows

echo.
echo ========================================
echo  Motion Pattern Detection ML Service
echo         Setup Script (Windows)
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH.
    echo Please install Python 3.8 or higher from https://www.python.org
    pause
    exit /b 1
)

echo [OK] Python found

REM Create virtual environment
echo.
echo Creating virtual environment...
python -m venv venv

if errorlevel 1 (
    echo Error: Failed to create virtual environment
    pause
    exit /b 1
)

echo [OK] Virtual environment created

REM Activate virtual environment
echo.
echo Activating virtual environment...
call venv\Scripts\activate.bat

echo [OK] Virtual environment activated

REM Install dependencies
echo.
echo Installing dependencies...
pip install --upgrade pip
pip install -r requirements.txt

if errorlevel 1 (
    echo Error: Failed to install dependencies
    pause
    exit /b 1
)

echo [OK] Dependencies installed

REM Train the model
echo.
echo Training Motion Pattern Detection model...
python motion_detector.py

if errorlevel 1 (
    echo Error: Failed to train model
    pause
    exit /b 1
)

echo.
echo ========================================
echo  Setup Complete!
echo ========================================
echo.
echo To start the ML service:
echo.
echo 1. Open command prompt in this directory
echo 2. Run: venv\Scripts\activate.bat
echo 3. Run: python app.py
echo.
echo The service will run on: http://localhost:5001
echo.
pause
