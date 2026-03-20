import base64
import logging
import time
import asyncio
import uuid
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from fastapi.concurrency import run_in_threadpool

from app.core.config import settings
from app.services.crawler import CrawlerService
from app.services.app_runner import app_step_runner
from app.services.device_service import device_service

logger = logging.getLogger(__name__)

class FallbackService:
    def __init__(self):
        self.crawler_service = CrawlerService()

    async def run_ai_fallback(
        self, 
        platform: str, 
        goal: str, 
        initial_url: Optional[str] = None,
        app_package: Optional[str] = None,
        device_id: Optional[str] = None,
        max_steps: int = 12,
        persona_context: Optional[str] = None,
        credentials: Optional[Dict[str, str]] = None,
        failure_analysis: Optional[Dict[str, Any]] = None,
        original_steps: Optional[List[Dict[str, Any]]] = None
    ) -> List[Dict[str, Any]]:
        """
        Runs an autonomous AI fallback loop to achieve a goal.
        Returns the history of steps taken.
        """
        history = []
        session_id = str(uuid.uuid4())
        
        logger.info(f"Starting AI Autonomous Fallback for goal: {goal}")
        
        # 1. Ensure/Connect Session
        try:
            if platform.upper() == "APP":
                # For APP, we assume the runner already has a driver if it failed,
                # but if we need a fresh session or different config, we start it.
                if not app_step_runner.driver:
                    target_device = device_id
                    if not target_device:
                        connected = device_service.get_connected_devices()
                        if connected:
                            target_device = connected[0]["id"]
                    
                    caps = {
                        "platformName": "Android",
                        "udid": target_device,
                        "automationName": "UiAutomator2",
                        "appPackage": app_package,
                        "noReset": True,
                        "dontStopAppOnReset": True
                    }
                    success, err = app_step_runner.start_session(caps)
                    if not success:
                        return [{"thought": f"Failed to start Appium session: {err}", "status": "Failed"}]
                
                # Activate app just in case
                if app_package:
                    try: app_step_runner.driver.activate_app(app_package)
                    except: pass
            else:
                # For WEB, we always start a fresh session for goal-based exploration (Headless for performance)
                await self.crawler_service.start_session(session_id, initial_url, headless=True)
        except Exception as e:
            logger.error(f"AI Fallback initial session failed: {e}")
            return [{"thought": f"Session initialization failed: {str(e)}", "status": "Failed"}]

        # 2. Loop until Completion
        for i in range(1, max_steps + 1):
            # A. Get Current State
            try:
                if platform.upper() == "APP":
                    xml_structure = app_step_runner.get_clean_source()
                    screenshot = app_step_runner.get_screenshot()
                    title = f"App ({app_package})"
                    url = "Native UI"
                else:
                    state = await self.crawler_service.get_state(session_id)
                    xml_structure = state.get("html_structure", "")
                    screenshot = state.get("screenshot", "")
                    title = state.get("title", "")
                    url = state.get("url", "")
            except Exception as e:
                logger.error(f"AI Fallback state capture error: {e}")
                history.append({"thought": f"State capture error: {str(e)}", "status": "Failed"})
                break

            # B. Ask AI for next action
            decision = await self._get_ai_decision(
                platform=platform,
                goal=goal,
                current_url=url,
                title=title,
                xml_structure=xml_structure,
                screenshot=screenshot,
                history=history,
                persona_context=persona_context,
                credentials=credentials,
                failure_analysis=failure_analysis,
                original_steps=original_steps
            )
            
            # Enrich decision with step number and state metadata
            decision["step_number"] = i
            history.append(decision)
            
            logger.info(f"AI Step {i}: {decision.get('description')} ({decision.get('status')})")
            
            if decision.get("status") == "Completed":
                logger.info(f"AI Fallback Goal Achieved at step {i}")
                break
            elif decision.get("status") == "Failed":
                logger.warning(f"AI Fallback declared failure at step {i}: {decision.get('thought')}")
                break
            
            # C. Execute Action
            try:
                action_type = decision.get("action_type", "wait").lower()
                target = decision.get("action_target", "")
                value = decision.get("action_value", "")
                
                # Handle placeholders
                if credentials:
                    if "{{USERNAME}}" in value: value = value.replace("{{USERNAME}}", credentials.get("username", ""))
                    if "{{PASSWORD}}" in value: value = value.replace("{{PASSWORD}}", credentials.get("password", ""))

                if platform.upper() == "APP":
                    # Smart mapping for Appium
                    s_type = "XPATH"
                    if target and not target.startswith("/"):
                        if ":id/" in target or "id/" in target: s_type = "ID"
                        # Fallback to text matching logic in app_runner if it's just a string
                    
                    step_dict = {
                        "action": action_type,
                        "selector_type": s_type,
                        "selector_value": target,
                        "option": value
                    }
                    action_res = app_step_runner.execute_step(step_dict)
                else:
                    action_res = await self.crawler_service.perform_action(session_id, action_type, target, value)
                
                if action_res and "error" in action_res and action_res["error"]:
                    decision["observation"] = f"Action Error: {action_res['error']}"
                    # We don't necessarily break here, AI can try something else next loop
                else:
                    decision["observation"] = "Action successfully executed."
                    
            except Exception as e:
                logger.error(f"AI Fallback execution error: {e}")
                decision["observation"] = f"Execution Exception: {str(e)}"
                decision["status"] = "Failed"
                break
                
            # D. Small stabilization wait
            await asyncio.sleep(3) # Increased for stability

            # E. For WEB: If we are still on about:blank and it's early steps, wait a bit more
            if platform.upper() == "WEB" and i <= 3:
                try:
                    state = await self.crawler_service.get_state(session_id)
                    if state.get("url") == "about:blank":
                        logger.info(f"Step {i}: Still on about:blank, waiting additional 5s for page load...")
                        await asyncio.sleep(5)
                except: pass

        # 3. Cleanup
        if platform.upper() == "WEB":
            try: await self.crawler_service.close_session(session_id)
            except: pass
            
        return history

    async def _get_ai_decision(self, **kwargs) -> Dict[str, Any]:
        """Calls Gemini with vision and DOM context."""
        from google import genai
        from google.genai import types
        import json
        
        if not settings.GOOGLE_API_KEY:
            return {"thought": "API Key missing", "status": "Failed", "action_type": "wait"}

        client = genai.Client(api_key=settings.GOOGLE_API_KEY)
        
        # Build multi-modal prompt
        prompt = self._build_prompt(**kwargs)
        contents = [prompt]
        
        if kwargs.get("screenshot"):
            contents.append(
                types.Part.from_bytes(
                    data=base64.b64decode(kwargs["screenshot"]),
                    mime_type="image/png"
                )
            )

        def _call_llm():
            return client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                )
            )

        try:
            response = await run_in_threadpool(_call_llm)
            text = response.text
            # Basic parsing cleaning
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].strip()
            
            return json.loads(text)
        except Exception as e:
            logger.error(f"Gemini Fallback Call Error: {e}")
            return {
                "thought": f"AI Logic Error: {str(e)}",
                "action_type": "wait",
                "status": "Failed",
                "description": "AI 연동 실패"
            }

    def _build_prompt(self, platform, goal, current_url, title, xml_structure, history, persona_context, credentials, failure_analysis=None, original_steps=None, **kwargs):
        history_summary = "\n".join([f"- Step {s.get('step_number')}: {s.get('description')} ({s.get('status')})" for s in history])
        
        analysis_context = ""
        if failure_analysis:
            analysis_context = f"\n[Original Failure Analysis]\n- Reason: {failure_analysis.get('reason')}\n- Thought: {failure_analysis.get('thought')}\n- Suggestion: {failure_analysis.get('suggestion')}\n"
        
        original_script_context = ""
        if original_steps:
            steps_text = "\n".join([f"  {i+1}. {s.get('action')} on '{s.get('selectorValue')}' ({s.get('stepName')})" for i, s in enumerate(original_steps)])
            original_script_context = f"\n[Original Script Steps (TO BE PRESERVED)]\n{steps_text}\n"

        cred_context = "Authorized credentials available." if credentials else "No specific credentials provided."
        persona_str = f"Adopt persona: {persona_context}" if persona_context else "As a standard QA Tester"

        return f"""
        You are a 'Self-Healing' Vision-AI Testing Agent.
        
        Goal: {goal}
        Platform: {platform}
        Current Page: {title} ({current_url})
        Context: {cred_context} / {persona_str}
        {analysis_context}
        {original_script_context}
        
        Previous Steps (During Current Recovery):
        {history_summary if history else "Start of Recovery process."}
        
        Simplified UI Structure (XML/HTML):
        {xml_structure}
        
        ---
        SELF-HEALING & VISION INSTRUCTIONS:
        1. REPAIR, DON'T REWRITE: Your primary job is to HEAL the original script. Preserve the sequence of steps as much as possible.
        2. PROBLEM SOLVING: If a step failed (e.g., selector changed), find the new selector. If a popup appeared, close it. If a wait is needed, add it.
        3. ROBUST ASSERTIONS: If an assertion failed step because of a volatile value (like a count '944 items'), suggest a more robust assertion that focuses on static text (e.g., "items") or partial matches instead of specific numbers.
        4. IMAGE REASONING: A screenshot of the current screen is attached. Use it to find elements that might be missing from the XML or to understand visual context.
        5. For 'action_target', you can use CSS/XPath/Text/ID.
        6. Focus on ACHIEVEMENT OF THE GOAL within the framework of the original script.
        
        CRITICAL RULES:
        - THOUGHT and DESCRIPTION must be in Korean (한국어).
        - If the goal is fully met and original script flow is recovered, set status='Completed'.
        - If you are stuck after 3 tries on same screen, set status='Failed'.
        - Available actions: navigate, click, type, scroll, wait, finish.
        
        JSON Output:
        {{
            "thought": "이유 및 전략 상세 (Korean)",
            "action_type": "navigate/click/type/scroll/wait/finish",
            "action_target": "CSS/XPath/Text/ID",
            "action_value": "text to type",
            "assert_text": "검증할 텍스트 (Rule Assertion)",
            "description": "동작 요약 (Korean)",
            "status": "In-Progress/Completed/Failed"
        }}
        """

fallback_service = FallbackService()
