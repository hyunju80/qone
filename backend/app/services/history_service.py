import uuid
import json
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.models.test import TestScript, TestHistory
from app.models.ai import AiExplorationSession
from app.core.config import settings

class HistoryService:
    SYSTEM_SCRIPT_NAME = "AI_AdHoc_Explorer"

    def _get_or_create_system_script(self, db: Session, project_id: str) -> TestScript:
        # Try to find a script for this project
        script = db.query(TestScript).filter(
            TestScript.name == self.SYSTEM_SCRIPT_NAME,
            TestScript.project_id == project_id
        ).first()

        if not script:
            # Create a new one for this project
            script = TestScript(
                id=str(uuid.uuid4()),
                project_id=project_id,
                name=self.SYSTEM_SCRIPT_NAME,
                description="System script for logging ad-hoc AI explorations",
                status="SYSTEM",
                code="pass", 
                origin="AI",
                is_active=True
            )
            db.add(script)
            db.commit()
            db.refresh(script)
        return script

    def save_ai_session(self, db: Session, session_data: dict, history_steps: list, final_status: str, project_id: str):
        """
        Saves the AI exploration session to DB.
        """
        # 1. Ensure System Script for the specific project
        script = self._get_or_create_system_script(db, project_id)

        # 2. Create TestHistory (Summary)
        history_id = str(uuid.uuid4())
        
        # Calculate duration if possible, generic for now
        duration = "N/A" 
        
        history_entry = TestHistory(
            id=history_id,
            script_id=script.id,
            script_name=script.name,
            status=final_status, # passed / failed
            duration=duration,
            persona_name=session_data.get("persona_name", "AI Agent"),
            trigger="manual",
            ai_summary=session_data.get("goal", "Ad-hoc Exploration"),
            logs=[], # We store detailed steps in separate table
            run_date=datetime.now(timezone(timedelta(hours=9)))
        )
        db.add(history_entry)

        # 3. Create AiExplorationSession (Details)
        # Calculate simple score average if available
        final_score = 0
        if history_steps:
            scores = [s.get("matching_score", 0) for s in history_steps]
            if scores:
                final_score = int(sum(scores) / len(scores))

        ai_session = AiExplorationSession(
            id=str(uuid.uuid4()),
            history_id=history_id,
            target_url=session_data.get("url"),
            goal=session_data.get("goal"),
            persona_id=session_data.get("persona_id"),
            steps_data=history_steps, # Full JSON dump
            final_score=final_score
        )
        db.add(ai_session)

        db.commit()
        return history_id

history_service = HistoryService()
