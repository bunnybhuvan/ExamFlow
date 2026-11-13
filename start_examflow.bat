@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if errorlevel 1 (
  echo Python launcher "py" was not found. Install Python 3.10 or newer and retry.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js/npm was not found. Install Node.js 20 or newer and retry.
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  if exist ".venv" rmdir /s /q ".venv"
  echo Creating Python 3.10 virtual environment...
  py -3.10 -m venv .venv
  if errorlevel 1 (
    if exist ".venv" rmdir /s /q ".venv"
    echo Python 3.10 was not found. Trying the default Python installation...
    py -3 -m venv .venv
  )
)
if not exist ".venv\Scripts\python.exe" (
  echo Could not create the Python virtual environment. Check your Python installation.
  pause
  exit /b 1
)

call ".venv\Scripts\activate.bat"
python -m pip --version >nul 2>nul
if errorlevel 1 (
  echo Repairing pip in the virtual environment...
  python -m ensurepip --upgrade
  if errorlevel 1 (
    echo Could not initialize pip. Repair or reinstall Python, then retry.
    pause
    exit /b 1
  )
)

if not exist ".venv\Scripts\uvicorn.exe" (
  echo Installing backend dependencies...
  python -m pip install --upgrade pip
  if errorlevel 1 (
    echo Failed to upgrade pip.
    pause
    exit /b 1
  )
  python -m pip install -r requirements.txt
  if errorlevel 1 (
    echo Backend dependency installation failed.
    pause
    exit /b 1
  )
)

if not exist "node_modules" (
  echo Installing frontend dependencies...
  npm install
  if errorlevel 1 (
    echo Frontend dependency installation failed.
    pause
    exit /b 1
  )
)

echo Starting ExamFlow API at http://localhost:8000
start "ExamFlow API" cmd /k "call .venv\Scripts\activate.bat ^&^& python -m uvicorn app.main:app --reload --port 8000"

echo Starting ExamFlow frontend...
npm run dev
