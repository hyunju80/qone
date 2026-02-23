from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request

app = FastAPI(
    title="Q-ONE AI Automation Agent",
    description="Backend API for Q-ONE AI Testing Solution",
    version="0.1.0",
)

# Startup Event: Initialize Scheduler
@app.on_event("startup")
def startup_event():
    from app.services.scheduler import scheduler as scheduler_service
    from app.db.session import SessionLocal
    from app import crud
    
    db = SessionLocal()
    try:
        schedules = crud.schedule.get_multi(db, limit=1000)
        print(f"[Scheduler] Loading {len(schedules)} schedules...")
        for sch in schedules:
            if sch.is_active:
                scheduler_service.add_job(sch)
    except Exception as e:
        print(f"[Scheduler] Failed to load schedules: {e}")
    finally:
        db.close()


# CORS middleware configuration
# Allow requests from the frontend (Vite default port 5173) and generic localhost
origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex="https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# CORS middleware configuration

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi import Request

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    import json
    error_details = exc.errors()
    print(f"\n[VALIDATION ERROR] URL: {request.url}\nDetails: {json.dumps(error_details, indent=2)}\n")
    return JSONResponse(
        status_code=422,
        content={"detail": error_details},
    )

from app.api.api_v1.api import api_router
from app.core.config import settings
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return {"message": "Welcome to Q-ONE API", "status": "running"}

@app.get("/health")
async def health_check():
    return {"status": "ok"}
