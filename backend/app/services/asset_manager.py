
from sqlalchemy.orm import Session
from app.models.ai import AiExplorationSession
from app.models.test import Scenario, TestScript
from app.models.project import Project
from app.schemas.scenario import TestCase
import uuid
from datetime import datetime
import json
from google import genai
from google.genai import types
from app.core.config import settings

class AssetManager:
    def convert_session_to_script(self, db: Session, ai_session: AiExplorationSession, project_id: str, platform: str = "WEB", capture_screenshots: bool = False, category: str = "Common"):
        # 1. Filter only meaningful actions
        meaningful_actions = [
            step for step in ai_session.steps_data 
            if type(step) is dict and step.get('action_type') in ['click', 'type', 'navigate', 'scroll', 'wait', 'finish']
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
                    "selectorValue": "-",
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
        
        # 2. Extract Data Patterns for Parameterization
        # If the session has fields and values, we should replace hardcoded values with {{FIELD}}
        data_map = {}
        for step in ai_session.steps_data:
            if isinstance(step, dict) and step.get('action_type') == 'type' and step.get('action_value'):
                # We don't have a formal "field name" during exploration yet, 
                # but we can look for common patterns or just use placeholders.
                # However, since save_history is often called with AI-generated data, 
                # let's try to match existing values to fields if possible.
                pass

        for idx, step in enumerate(meaningful_actions):
            action = step.get('action_type')
            target = step.get('action_target') or ''
            val = step.get('action_value') or ''
            desc = step.get('description', f"Step {idx+1}")
            
            # [DDT ENHANCEMENT] 
            # If the user is converting a session that was JUST generated with test data,
            # (or if we find a value exactly matching a known field), replace with {{placeholder}}.
            # In AI Exploration, the 'observation' or 'thought' might contain hints.
            # For now, let's use a simple heuristic: if action is 'type' and we are assetizing, 
            # and we have a reasonable guess for the field name (from description or target), use it.
            # Actually, the most reliable way is if the ai_session.steps_data ALREADY had field info.
            
            # Simple heuristic: if 'action_value' exists, see if it looks like it was meant to be dynamic.
            # If the description contains the field name, or if we have it in the history.
            
            # If this session was saved via the AI Generator -> Dataset Studio flow, 
            # the 'history' passed to SaveRequest might already contain the fields.
            # Let's try to find if 'val' matches any known field's value in the session.
            
            final_val = val
            # [DDT ENHANCEMENT] Proactive Placeholder Injection
            # 1. Check if the step already has a 'field' metadata (e.g. from AI Generator)
            if step.get('field'):
                final_val = f"{{{{{step.get('field')}}}}}"
            elif action == 'type' and val:
                # 2. Heuristic: Scan description for quoted terms or terms that might be field names
                # Examples: "'검색창'에 '로밍'을 입력합니다" -> if '검색창' is in description, it's a good placeholder candidate
                import re
                # Look for single/double quoted korean/english words likely to be field labels
                matches = re.findall(r"['\"]([^'\"]+)['\"]", desc)
                if matches:
                    # If multiple, the first is often the field, second is the value
                    potential_field = matches[0]
                    # If the value we are typing is also in the description (like '로밍'),
                    # and there's another quoted term, assume the other is the field.
                    if len(matches) >= 2 and val in desc:
                        # If matches[1] is the value, then matches[0] is the field
                        if matches[1] == val:
                            final_val = f"{{{{{matches[0]}}}}}"
                        elif matches[0] == val:
                            final_val = f"{{{{{matches[1]}}}}}"
                    else:
                        # Simple fallback: if there's only one quoted thing and it's NOT the value, 
                        # it might be the field name. 
                        if matches[0] != val and len(matches[0]) < 20:
                            final_val = f"{{{{{matches[0]}}}}}"

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
                
            # Determine assertion text: Prefer actual observed landmark from the NEXT step
            # If this is the last step, fallback to its own predicted expected_text
            next_step_data = meaningful_actions[idx + 1] if idx + 1 < len(meaningful_actions) else None
            assert_val = ""
            if next_step_data:
                assert_val = next_step_data.get('actual_observed_text', '')
            
            if not assert_val:
                assert_val = step.get('expected_text', '')

            # Update initial navigation/launch assertion if first step has actual_observed_text
            if idx == 0 and test_steps and test_steps[0].get('action') in ['navigate', 'activateApp']:
                test_steps[0]['assertText'] = step.get('actual_observed_text', '')

            test_steps.append({
                "id": str(uuid.uuid4()),
                "stepName": f"{str(action).capitalize()} Target",
                "action": action,
                "selectorType": selector_type,
                "selectorValue": target,
                "inputValue": final_val,
                "description": desc,
                "assertText": assert_val
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
            code=script_code,
            status="PENDING",
            origin="AI_EXPLORATION", # Reverted from STEP to maintain root origin distinction
            tags=["AI_EXPLORATION"],
            engine="Appium" if platform.upper() == "APP" else "Playwright",
            platform=platform.upper(),
            capture_screenshots=capture_screenshots,
            is_active=True,
            steps=test_steps,
            persona_id=ai_session.persona_id,
            category=category
        )
        
        # Mark session as assetized and link assets
        ai_session.is_assetized = True
        ai_session.generated_script_id = new_script.id
        
        db.add(new_script)
        db.add(ai_session) # Ensure update is committed
        db.commit()
        db.refresh(new_script)
        
        return new_script

    def convert_session_to_scenario(self, db: Session, session_or_id, project_id: str = None, platform: str = "WEB", capture_screenshots: bool = False, category: str = "Common", scenario_id: str = None):
        """
        Converts an AI Exploration Session into BOTH a Scenario and a TestScript.
        """
        from app.models.ai import AiExplorationSession
        
        if isinstance(session_or_id, str):
            ai_session = db.query(AiExplorationSession).filter(AiExplorationSession.id == session_or_id).first()
            if not ai_session:
                raise ValueError("Session not found")
        else:
            ai_session = session_or_id
            if not ai_session:
                raise ValueError("Session object is None")

        # Prioritize passed project_id
        final_project_id = project_id
        if not final_project_id and ai_session.history and ai_session.history.project_id:
            final_project_id = ai_session.history.project_id
        
        # 1. Create the Script
        script = self.convert_session_to_script(db, ai_session, final_project_id, platform=platform, capture_screenshots=capture_screenshots, category=category)

        # 2. Handle Scenario (Update or Create)
        if scenario_id:
            new_scenario = db.query(Scenario).filter(Scenario.id == scenario_id).first()
            if not new_scenario:
                raise ValueError(f"Scenario {scenario_id} not found")
            new_scenario.golden_script_id = script.id
            if category:
                new_scenario.category = category
        else:
            test_cases = [{
                "id": f"tc_{str(uuid.uuid4())[:8]}",
                "title": f"Verified Flow: {ai_session.goal[:50]}",
                "description": ai_session.goal,
                "status": "completed",
                "preCondition": f"Start at {ai_session.target_url}",
                "inputData": "",
                "steps": [s.get('description', '') for s in ai_session.steps_data if isinstance(s, dict)],
                "expectedResult": "Goal achieved successfully."
            }]

            new_scenario = Scenario(
                id=str(uuid.uuid4()),
                project_id=final_project_id,
                title=f"AI_Exploration: {ai_session.goal[:30]}...",
                description=f"Generated from AI Exploration session {ai_session.id}",
                test_cases=test_cases,
                is_approved=True,
                platform=platform,
                target=ai_session.target_url,
                tags=["AI_EXPLORATION"],
                golden_script_id=script.id,
                persona_id=ai_session.persona_id,
                category=category
            )
            db.add(new_scenario)

        ai_session.generated_scenario_id = new_scenario.id
        db.add(ai_session)
        db.commit()
        db.refresh(new_scenario)

        return new_scenario, script

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
                elif action == 'wait':
                     lines.append(f"    time.sleep({float(val) if val else 1.0})")
                elif action == 'finish':
                     lines.append(f"    # Explicit finish step for final assertion")
                     lines.append("    pass")
                
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

    def determine_category(self, db: Session, project_id: str, goal: str, steps_data: list) -> str:
        """
        Asks Gemini to pick the most suitable category from the project's categories
        based on the exploration goal and history.
        """
        if not settings.GOOGLE_API_KEY:
            return "Common"

        from app.models.project import Project
        from app.schemas.project import Project as ProjectSchema
        
        proj = db.query(Project).filter(Project.id == project_id).first()
        if not proj:
            return "Common"
            
        pschema = ProjectSchema.model_validate(proj)
        if not pschema.categories:
            return "Common"

        cats_str = ", ".join([f"'{c.name}'" + (f" (Desc: {c.description})" if c.description else "") for c in pschema.categories])
        
        # Summarize steps
        step_descriptions = [s.get('description', '') for s in steps_data if isinstance(s, dict)]
        steps_summary = "\n".join([f"- {d}" for d in step_descriptions[:20]])

        client = genai.Client(api_key=settings.GOOGLE_API_KEY)
        prompt = f"""
        You are a QA Taxonomy Expert.
        Target Project Category List: [{cats_str}]
        
        Exploration Goal: {goal}
        Executed Steps:
        {steps_summary}
        
        Based on the goal and steps, assign exactly ONE category from the provided list that best fits this test scenario.
        If none fit perfectly, pick 'Common' or the closest match.
        
        Return ONLY the name of the category.
        """

        try:
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="text/plain",
                )
            )
            suggested = response.text.strip()
            # Validate if it exists in the list
            valid_names = [c.name for c in pschema.categories]
            if suggested in valid_names:
                return suggested
            
            # Case insensitive fallback
            for vn in valid_names:
                if vn.lower() == suggested.lower():
                    return vn
                    
            return "Common"
        except Exception as e:
            print(f"Failed to auto-categorize exploration: {e}")
            return "Common"
