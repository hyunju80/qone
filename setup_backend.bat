@echo off
echo Setting up Q-ONE Backend...

cd backend

if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)

echo Installing dependencies...
venv\Scripts\pip install -r requirements.txt

echo Applying database migrations...
set PYTHONPATH=.
venv\Scripts\alembic upgrade head

echo Seeding initial data...
venv\Scripts\python -m app.initial_data

echo Setup complete!
echo To run the server: cd backend && venv\Scripts\uvicorn app.main:app --reload
pause
