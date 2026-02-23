
from sqlalchemy.orm import Session
from app.models.ai import AiExplorationSession
from app.models.test import Scenario, TestScript
from app.models.project import Project
from app.schemas.scenario import TestCase
import uuid
from datetime import datetime
import json

class AssetManager:
    def convert_session_to_scenario(self, db: Session, session_id: str):
        # 1. Fetch the Session
        ai_session = db.query(AiExplorationSession).filter(AiExplorationSession.id == session_id).first()
        if not ai_session:
            raise ValueError("Session not found")
            
        history = ai_session.history
        project_id = history.script.project_id if history.script else None
        
        if not project_id:
            # Fallback if we can't find project via script (shouldn't happen with correct data)
            project = db.query(Project).first()
            if project:
                project_id = project.id
            else:
                 raise ValueError("Project context missing")

        # 2. Logic: Create Test Case Steps from AI Steps
        # Filter only meaningful actions
        meaningful_actions = [
            step for step in ai_session.steps_data 
            if step.get('action_type') in ['click', 'type', 'navigate', 'scroll']
        ]
        
        test_steps = []
        for idx, step in enumerate(meaningful_actions):
            desc = step.get('description', f"Step {idx+1}")
            action = step.get('action_type')
            target = step.get('action_target')
            val = step.get('action_value')
            
            step_str = f"[{action.upper()}] {desc}"
            if target:
                step_str += f" (Target: {target})"
            if val:
                step_str += f" (Value: {val})"
                
            test_steps.append(step_str)

        # 3. Create Scenario
        scenario_id = str(uuid.uuid4())
        scenario_title = f"AI Exploration: {ai_session.goal[:50]}"
        
        new_scenario = Scenario(
            id=scenario_id,
            project_id=project_id,
            title=scenario_title,
            description=f"Auto-generated from AI Session {session_id}. Target: {ai_session.target_url}",
            test_cases=[{
                "id": str(uuid.uuid4()),
                "title": "AI Execution Flow",
                "description": "Automatically recorded steps from AI exploration.",
                "steps": test_steps,
                "expectedResult": ai_session.goal,
                "status": "pending"
            }],
            tags=["AI_EXPLORATION"],
            is_approved=True, # Auto-approve/save as draft? Let's say it's saved as an asset.
            created_at=datetime.utcnow()
        )
        
        # 4. Generate Python Script (Playwright)
        script_code = self._generate_playwright_script(ai_session.target_url, meaningful_actions)
        
        script_id = str(uuid.uuid4())
        new_script = TestScript(
            id=script_id,
            project_id=project_id,
            name=f"AI_AutoScript_{datetime.now().strftime('%Y%m%d_%H%M')}",
            description=f"Generated from Scenario: {scenario_title}",
            status="CERTIFIED", # Ready to run
            code=script_code,
            origin="AI_EXPLORATION",
            tags=["AI_EXPLORATION"],
            engine="Playwright",
            is_active=True
        )
        
        # Link them
        new_scenario.golden_script_id = script_id
        
        # Mark session as assetized and link assets
        ai_session.is_assetized = True
        ai_session.generated_scenario_id = new_scenario.id
        ai_session.generated_script_id = new_script.id
        
        db.add(new_scenario)
        db.add(new_script)
        db.add(ai_session) # Ensure update is committed
        db.commit()
        db.refresh(new_scenario)
        db.refresh(new_script)
        
        return new_scenario, new_script

    def _generate_playwright_script(self, url: str, steps: list) -> str:
        """
        Synthesizes a simple Playwright script compatible with Pytest.
        """
        lines = [
            "from playwright.sync_api import Page, expect",
            "import time",
            "",
            "def test_ai_generated_flow(page: Page):",
            f"    # Initial Navigation",
            f"    page.goto('{url}')",
            "    page.wait_for_load_state('networkidle')",
            ""
        ]
        
        for idx, step in enumerate(steps):
            action = step.get('action_type')
            target = step.get('action_target') # Assume CSS selector
            val = step.get('action_value')
            desc = step.get('description', '').replace("'", "\\'")
            
            # Helper to handle popups dynamically (mirroring CrawlerService behavior)
            lines.append(f"    # Step {idx+1}: {desc}")
            lines.append("    current_page = page.context.pages[-1] if page.context.pages else page")
            lines.append("    current_page.bring_to_front()")
            
            try:
                if action == 'click':
                    if target:
                        # Improved heuristic: Treat as selector if it contains common CSS/XPath chars
                        # or starts with a tag name (simple check)
                        is_selector = any(c in target for c in ['.', '#', '[', '/', '>'])
                        
                        if is_selector:
                            lines.append(f"    current_page.click('{target}')")
                        else:
                            # Fallback for pure text labels
                             lines.append(f"    current_page.get_by_text('{target}').first.click()")
                elif action == 'type':
                     lines.append(f"    current_page.fill('{target}', '{val}')")
                elif action == 'navigate':
                     lines.append(f"    current_page.goto('{val}')")
                elif action == 'scroll':
                     lines.append(f"    current_page.evaluate('window.scrollBy(0, 500)')")
                
                # Default wait after action (using time.sleep to avoid error if page closes)
                lines.append("    time.sleep(1.0)")
                # Force update screenshot for UI visibility
                lines.append("    try:")
                lines.append("        current_page.screenshot(path='latest.jpg')")
                lines.append("    except:")
                lines.append("        pass")
            except:
                lines.append(f"    # [WARN] Could not generate code for action: {action}")
                
        # Assertion for goal? For now just finish
        lines.append("")
        lines.append("    # Execution Complete")
        
        return "\n".join(lines)
