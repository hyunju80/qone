from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session
from app.api import deps
from app import crud, models
from app.services.runner import runner_service as runner
from app.db.session import SessionLocal
import logging

logger = logging.getLogger(__name__)

class SchedulerService:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(SchedulerService, cls).__new__(cls)
            cls._instance.scheduler = BackgroundScheduler()
            cls._instance.scheduler.start()
        return cls._instance

    def add_job(self, schedule: models.TestSchedule):
        """
        Add or Update a job for the given schedule.
        """
        # Remove existing if any (to update)
        self.remove_job(schedule.id)
        
        if not schedule.is_active:
             logger.info(f"Schedule {schedule.id} is inactive. Not adding job.")
             return

        if schedule.trigger_strategy == 'SCHEDULE' or schedule.trigger_strategy == 'BOTH':
             try:
                 # Parse cron expression roughly. NOTE: Ensure format is "* * * * *"
                 # user input: "0 0 * * *" -> minute hour day month day_of_week
                 parts = schedule.cron_expression.split()
                 if len(parts) != 5:
                     logger.error(f"Invalid cron format for {schedule.id}: {schedule.cron_expression}")
                     return

                 trigger = CronTrigger(
                     minute=parts[0], hour=parts[1], day=parts[2], month=parts[3], day_of_week=parts[4]
                 )
                 
                 self.scheduler.add_job(
                     self.execute_job,
                     trigger=trigger,
                     id=schedule.id,
                     args=[schedule.id],
                     replace_existing=True
                 )
                 logger.info(f"Added job for schedule {schedule.id} with cron {schedule.cron_expression}")
             except Exception as e:
                 logger.error(f"Failed to add job {schedule.id}: {e}")

    def remove_job(self, schedule_id: str):
        """
        Remove a job.
        """
        if self.scheduler.get_job(schedule_id):
            self.scheduler.remove_job(schedule_id)
            logger.info(f"Removed job {schedule_id}")

    def execute_job(self, schedule_id: str):
        """
        The actual job function.
        """
        logger.info(f"Executing scheduled job: {schedule_id}")
        try:
            # 1. Fetch Data Phase
            db: Session = SessionLocal()
            scripts_to_run = []
            schedule_name = ""
            try:
                schedule = crud.schedule.get(db, id=schedule_id)
                if not schedule:
                    logger.error(f"Schedule {schedule_id} not found during execution.")
                    return
                
                schedule_name = schedule.name
                
                # specific script association objects
                schedule_scripts = schedule.scripts 
                
                for schedule_script in schedule_scripts:
                     script = schedule_script.script
                     if script:
                         scripts_to_run.append({
                             "id": script.id,
                             "name": script.name,
                             "project_id": script.project_id,
                             "code": script.code,
                             "origin": script.origin,
                             "platform": getattr(script, 'platform', 'WEB'),
                             "steps": getattr(script, 'steps', [])
                         })
            finally:
                db.close() # Release DB connection immediately

            # 2. Execution Phase (No DB Lock)
            from datetime import datetime, timezone, timedelta
            KST = timezone(timedelta(hours=9))
            
            for script_data in scripts_to_run:
                 logger.info(f"Running script {script_data['name']} for schedule {schedule_name}")
                 
                 # Prepare a mock object for runner if needed, or update runner to accept dict
                 # Currently runner.run_script expects an object with .code attribute
                 class ScriptObj:
                     def __init__(self, data):
                         self.code = data['code']
                         self.name = data['name']
                         self.origin = data.get('origin', '')
                         self.platform = data.get('platform', 'WEB')
                         self.steps = data.get('steps', [])
                         self.project_id = data.get('project_id')
                 
                 script_obj = ScriptObj(script_data)
                 
                 try:
                     report = runner.run_script(script_obj)
                     status = "passed" if report['passed'] else "failed"
                     logs = report['logs']
                     failure_reason = report.get('error')
                     duration = report['duration']
                     step_results = report.get('step_results', [])
                 except Exception as exc:
                     logger.error(f"Error running script {script_data['name']}: {exc}")
                     status = "failed"
                     logs = [{"msg": str(exc), "type": "error"}]
                     failure_reason = str(exc)
                     duration = "0s"
                     step_results = []

                 # 3. Save Result Phase (Short DB Lock)
                 db_save: Session = SessionLocal()
                 import uuid
                 try:
                     history_in = models.TestHistory(
                         id=f"hist_{uuid.uuid4().hex[:16]}",
                         project_id=script_data['project_id'],
                         script_id=script_data['id'],
                         script_name=script_data['name'],
                         status=status,
                         duration=duration,
                         logs=logs,
                         trigger="scheduled",
                         schedule_id=schedule_id,
                         schedule_name=schedule_name,
                         failure_reason=failure_reason,
                         step_results=step_results,
                         run_date=datetime.now(KST)
                     )
                     db_save.add(history_in)
                     db_save.commit()
                 except Exception as e:
                     logger.error(f"Failed to save history for {script_data['name']}: {e}")
                 finally:
                     db_save.close()

            # 4. Update Schedule Metadata
            db_meta: Session = SessionLocal()
            try:
                schedule = crud.schedule.get(db_meta, id=schedule_id)
                if schedule:
                    schedule.last_run = datetime.now(KST)
                    db_meta.add(schedule)
                    db_meta.commit()
            finally:
                db_meta.close()

        except Exception as e:
            logger.error(f"Job execution failed: {e}")
        finally:
            db.close()

scheduler = SchedulerService()
