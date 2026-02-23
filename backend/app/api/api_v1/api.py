from fastapi import APIRouter

from app.api.api_v1.endpoints import login, users, projects, customers, scripts, scenarios, history, schedules, ai, run, personas, exploration, steps, assets, inspector

api_router = APIRouter()
api_router.include_router(login.router, tags=["login"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(customers.router, prefix="/customers", tags=["customers"])
api_router.include_router(scripts.router, prefix="/scripts", tags=["scripts"])
api_router.include_router(scenarios.router, prefix="/scenarios", tags=["scenarios"])
api_router.include_router(history.router, prefix="/history", tags=["history"])
api_router.include_router(schedules.router, prefix="/schedules", tags=["schedules"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(run.router, prefix="/run", tags=["run"])
api_router.include_router(personas.router, prefix="/personas", tags=["personas"])
api_router.include_router(exploration.router, prefix="/exploration", tags=["exploration"])
api_router.include_router(steps.router, prefix="/steps", tags=["steps"])
api_router.include_router(assets.router, prefix="/assets", tags=["assets"])
api_router.include_router(inspector.router, prefix="/inspector", tags=["inspector"])

