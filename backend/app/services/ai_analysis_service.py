import base64
import logging
import json
import asyncio
from typing import List, Dict, Any, Optional
from fastapi.concurrency import run_in_threadpool
from app.core.config import settings

logger = logging.getLogger(__name__)

class AIAnalysisService:
    def __init__(self):
        pass

    async def analyze_failure(
        self,
        logs: List[Dict[str, Any]],
        screenshot_b64: Optional[str] = None,
        platform: str = "WEB",
        script_name: str = "Unknown Script",
        failure_reason: str = "Unknown Error"
    ) -> Dict[str, Any]:
        """
        Analyzes a test failure using Gemini Vision/LLM.
        Returns a structured dictionary of the analysis.
        """
        if not settings.GOOGLE_API_KEY:
            logger.warning("Google API Key missing. Skipping AI Analysis.")
            return {
                "reason": "AI 연동 설정 누락",
                "thought": "Google API Key가 설정되지 않았습니다.",
                "suggestion": "설정에서 API 키를 입력해 주세요.",
                "confidence": 0
            }

        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.GOOGLE_API_KEY)
        
        # Prepare context
        log_summary = "\n".join([f"[{l.get('type', 'INFO').upper()}] {l.get('msg')}" for l in logs[-20:]]) # Last 20 lines
        
        prompt = f"""
        당신은 QA 자동화 테스트 전문가이자 장애 분석 AI입니다.
        테스트 실행 중 발생한 실패(Failure)를 분석하고 원인과 해결 방안을 제시해 주세요.

        [테스트 정보]
        - 스크립트명: {script_name}
        - 플랫폼: {platform}
        - 발생한 에러: {failure_reason}

        [실행 로그 (마지막 20줄)]
        {log_summary}

        ---
        [분석 지침]
        1. 첨부된 스크린샷(실패 시점)과 로그를 종합적으로 분석하세요.
        2. 실패 원인이 코드 문제인지, UI 변경(Selector) 문제인지, 혹은 환경/네트워크 문제인지 판단하세요.
        3. 해결을 위한 구체적인 가이드(코드 수정 제안 등)를 포함하세요.
        4. 모든 텍스트 답변은 한국어(Korean)로 작성해 주세요.

        [출력 형식 (JSON)]
        {{
            "thought": "분석 과정 및 추론 (상세)",
            "reason": "실패의 직접적인 원인 요약 (한 문장)",
            "suggestion": "구체적인 해결 방안/수정 가이드",
            "confidence": 0~100 사이의 분석 신뢰도 숫자
        }}
        """

        contents = [prompt]
        if screenshot_b64:
            try:
                contents.append(
                    types.Part.from_bytes(
                        data=base64.b64decode(screenshot_b64),
                        mime_type="image/png"
                    )
                )
            except Exception as e:
                logger.error(f"Failed to attach screenshot to AI Analysis: {e}")

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
            
            # Cleaning markdown code blocks if present
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].strip()
            
            return json.loads(text)
        except Exception as e:
            logger.error(f"AI Failure Analysis Error: {e}")
            return {
                "thought": f"AI 분석 중 오류가 발생했습니다: {str(e)}",
                "reason": "AI 분석 서비스 통신 실패",
                "suggestion": "로그를 직접 확인하거나 다시 시도해 주세요.",
                "confidence": 0
            }

ai_analysis_service = AIAnalysisService()
