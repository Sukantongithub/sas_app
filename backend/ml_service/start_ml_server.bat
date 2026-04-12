@echo off
REM ML Service Startup Script for Windows
REM Starts the Flask-based Motion Classification server on port 5001

echo.
echo ========================================
echo ML Service - Motion Classification
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://www.python.org
    pause
    exit /b 1
)

REM Check if in correct directory
if not exist "ml_server.py" (
    echo Error: ml_server.py not found
    echo Please run this script from the ml_service directory
    echo Current directory: %cd%
    pause
    exit /b 1
)

REM Check and install dependencies
echo Checking dependencies...
pip list | findstr "flask flask-cors scikit-learn numpy pandas joblib" >nul

if %errorlevel% neq 0 (
    echo Installing required packages...
    pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo Error: Failed to install dependencies
        pause
        exit /b 1
    )
)

echo.
echo ========================================
echo Starting ML Server...
echo ========================================
echo.
echo Server will run on: http://127.0.0.1:5001
echo.
echo Available endpoints:
echo   POST /predict          - Classify single motion
echo   POST /batch-predict    - Classify multiple motions
echo   GET  /health           - Health check
echo   GET  /stats            - Prediction statistics
echo   POST /retrain          - Retrain model
echo   POST /clear-buffer     - Clear buffer
echo.
echo Press Ctrl+C to stop the server
echo.

REM Run the server
python ml_server.py

pause
