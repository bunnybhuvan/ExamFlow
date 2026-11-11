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
  echo Creating Python virtual environment...
  py -m venv .venv
)
call ".venv\Scripts\activate.bat"

if not exist ".venv\Scripts\uvicorn.exe" (
  echo Installing backend dependencies...
  python -m pip install --upgrade pip
  pip install -r requirements.txt
)

if not exist "node_modules" (
  echo Installing frontend dependencies...
  npm install
)

echo Starting ExamFlow API at http://localhost:8000
start "ExamFlow API" cmd /k "call .venv\Scripts\activate.bat ^&^& uvicorn app.main:app --reload --port 8000"

echo Starting ExamFlow frontend...
npm run dev
