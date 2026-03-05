
from sqlalchemy.orm import Session
from app.models.ai import AiExplorationSession
from app.models.test import Scenario, TestScript
from app.models.project import Project
from app.schemas.scenario import TestCase
import uuid
from datetime import datetime
import json

class AssetManager:
    def convert_session_to_script(self, db: Session, ai_session: AiExplorationSession, project_id: str, platform: str = "WEB", capture_screenshots: bool = False):
        # 1. Filter only meaningful actions
        meaningful_actions = [
            step for step in ai_session.steps_data 
            if type(step) is dict and step.get('action_type') in ['click', 'type', 'navigate', 'scroll']
        ]
        
        # 2. Extract Native Step Format for Asset View/Execution
        test_steps = []
        
        if platform.upper() == "APP":
            if ai_session.target_url and str(ai_session.target_url).strip():
                test_steps.append({
                    "id": str(uuid.uuid4()),
                    "stepName": "Open App",
                    "action": "activateApp",
                    "selectorType": "PACKAGE",
                    "selectorValue": "",
                    "inputValue": ai_session.target_url,
                    "description": f"Launch App: {ai_session.target_url}"
                })
        else:
            # Must always start with initial navigation for WEB
            test_steps.append({
                "id": str(uuid.uuid4()),
                "stepName": "Initial Navigation",
                "action": "navigate",
                "selectorType": "",
                "selectorValue": "",
                "inputValue": ai_session.target_url,
                "description": f"Navigate to {ai_session.target_url}"
            })
        
        for idx, step in enumerate(meaningful_actions):
            action = step.get('action_type')
            target = step.get('action_target') or ''
            val = step.get('action_value') or ''
            desc = step.get('description', f"Step {idx+1}")
            
            # Simple heuristic for selector type
            is_xpath = target.startswith('//') or target.startswith('(/')
            selector_type = "XPATH" if is_xpath else "CSS"
            
            if platform.upper() == "APP":
                if ":id/" in target or target.startswith("id/"):
                    selector_type = "ID"
                elif not is_xpath and not any(c in target for c in ['.', '#', '[', '/', '>', ':', '=']):
                    selector_type = "TEXT"
                elif not is_xpath:
                    selector_type = "XPATH" # CSS is not widely supported in native Appium
            else:
                if not any(c in target for c in ['.', '#', '[', '/', '>', ':', '=']) and action == 'click':
                    selector_type = "TEXT"
                
            test_steps.append({
                "id": str(uuid.uuid4()),
                "stepName": f"{str(action).capitalize()} Target",
                "action": action,
                "selectorType": selector_type,
                "selectorValue": target,
                "inputValue": val,
                "description": desc,
                "assertText": step.get('expected_text', '')
            })
            
        # 3. Generate Python Script (Playwright)
        script_code = self._generate_playwright_script(ai_session.target_url, meaningful_actions)
        
        script_title = f"AI_Exploration: {ai_session.goal[:30]}"
        script_id = str(uuid.uuid4())
        new_script = TestScript(
            id=script_id,
            project_id=project_id,
            name=script_title,
            description=f"Auto-generated from AI Session {ai_session.id}. Target: {ai_session.target_url}",
            status="CERTIFIED", # Ready to run
            code=script_code,
            origin="AI_EXPLORATION",
            tags=["AI_EXPLORATION"],
            engine="Appium" if platform.upper() == "APP" else "Playwright",
            platform=platform.upper(),
            capture_screenshots=capture_screenshots,
            is_active=True,
            steps=test_steps
        )
        
        # Mark session as assetized and link assets
        ai_session.is_assetized = True
        ai_session.generated_script_id = new_script.id
        
        db.add(new_script)
        db.add(ai_session) # Ensure update is committed
        db.commit()
        db.refresh(new_script)
        
        return new_script

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
            target = step.get('action_target') or '' # Assume CSS selector
            val = step.get('action_value') or ''
            desc = step.get('description', '').replace("'", "\\'")
            
            # Normalize pseudo-classes for Playwright
            if ":contains(" in target:
                target = target.replace(":contains(", ":has-text(")
            
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
