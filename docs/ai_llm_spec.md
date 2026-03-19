# AI Generator: LLM Specification & Technical Protocol

이 문서는 Q-ONE의 실제 백엔드 소스 코드(`scenarios.py`, `ai.py`, `exploration.py`, `asset_manager.py`) 분석을 기반으로 작성되었습니다. AI 에이전트(Oracle)과 Google Gemini 3 모델 간의 통신 프로토콜, 프롬프트 전략 및 입출력 규격을 정의하며, LLM 튜닝 및 성능 최적화를 위한 실질적인 참조 자료로 사용됩니다.

---

## 1. 개요 및 핵심 기술 (Core Technical Foundation)

Q-ONE의 AI Generator는 Gemini 3 모델을 핵심 엔진으로 사용하여 시나리오 설계부터 실행 데이터 생성, 그리고 자율 탐색을 통한 자산화까지의 전 과정을 자동화합니다.

*   **LLM Engine**: Google Gemini 3 (Flash Preview) - 멀티모달 분석(이미지+텍스트) 및 JSON Schema 출력이 핵심.
*   **Browsing/Crawl**: 
    *   **WEB**: Playwright (CrawlerService) - 헤드리스 브라우저 제어 및 DOM 트리 추출.
    *   **APP**: Appium (app_step_runner) - Android/iOS 네이티브 앱 UI 및 XML 소스 분석.
*   **Vision Analysis**: 스크린샷과 최적화된 DOM 구조를 동시에 LLM에 주입하여 요소 식별 정확도 극대화.
*   **Automation Pipeline**: `AssetManager` 서비스를 통해 AI 탐색 이력을 `Playwright/Appium` 실행 코드로 즉시 변환하고, 입력 리터럴 값을 분석하여 `{{FIELD}}` 형태의 변수를 자동 주입(Parameterization)합니다.

---

## 2. Scenario Generation (시나리오 생성 프로토콜)
*   **진입점**: `/scenarios/analyze-url`, `/scenarios/analyze-upload`
*   **모델**: `gemini-3-flash-preview` (또는 설정된 모델)

### 2.1. System Prompt (전체 시스템 프롬프트)
```text
You are an Expert QA Automation Engineer.
Analyze the provided web page context (Screenshot + DOM Structure).

First, internally identify critical business flows and functional features.
Then, DIRECTLY design a comprehensive Test Scenario Suite based on those findings.

[CRITICAL INSTRUCTION]
The generated 'steps' MUST NOT be implementation-specific UI actions (e.g., "Click button X", "Type Y into field").
Instead, the 'steps' MUST be high-level User Intents or Business Logic goals (e.g., "Authenticate as an Admin", "Navigate to the billing section").
These scenarios will be executed by an Autonomous AI Browser Agent that will figure out the actual UI interactions on its own. Focus strictly on WHAT needs to be done and verified, not HOW to do it.

[Design Rules]
1. Output must be a valid JSON object with a single key 'scenarios'.
2. 'scenarios' is a list of objects, each MUST have:
   - "title": (string) Scenario Name
   - "description": (string) Purpose
   - "category": (string) The specific domain module or division this scenario belongs to (e.g., "Authentication", "Checkout").
   - "testCases": (list of objects)
3. Each "testCases" item MUST have:
   - "title": (string) Case Name
   - "preCondition": (string)
   - "inputData": (string)
   - "steps": (list of strings) - High-level intents only!
   - "expectedResult": (string)
   - "selectors": (list of objects) List of { "name": "ElementName", "value": "CSS/XPath" }

[Selector Strategy]
- Analyze the DOM structure deeply to find robust selectors for Key elements.
- Prioritize finding SPECIFIC functional elements (e.g. Navigation Links, GNB items, Submit Buttons).
- Prefer ID > Name > TestId > CSS Classes > XPath.
- Ensure selectors are unique and precise.

Return the result as a JSON object with a 'scenarios' array.
Language: Korean.
```

### 2.2. Input Data (전달되는 값 상세)
*   **Screenshot**: Base64 encoded JPEG 이미지 (멀티모달 주입).
*   **DOM Structure**: `html_structure` (Playwright를 통해 텍스트 노드 위주로 단순화된 HTML).
*   **Context**: 사용자가 추가로 입력한 프롬프트 (예: "로그인 기능 위주로 생성해줘").
*   **Project Categories Context**: 
    `This project uses the following predefined categories for taxonomy: {cats_str}. You MUST carefully assign exactly one of these categories to each generated scenario.`

### 2.3. Output Format (수신 데이터 스키마)
```json
{
  "type": "OBJECT",
  "properties": {
    "scenarios": {
      "type": "ARRAY",
      "items": {
        "type": "OBJECT",
        "properties": {
          "title": {"type": "STRING"},
          "description": {"type": "STRING"},
          "category": {"type": "STRING"},
          "testCases": {
            "type": "ARRAY",
            "items": {
              "type": "OBJECT",
              "properties": {
                "title": {"type": "STRING"},
                "preCondition": {"type": "STRING"},
                "inputData": {"type": "STRING"},
                "steps": {"type": "ARRAY", "items": {"type": "STRING"}},
                "expectedResult": {"type": "STRING"},
                "selectors": {
                  "type": "ARRAY",
                  "items": {
                    "type": "OBJECT",
                    "properties": {
                      "name": {"type": "STRING"},
                      "value": {"type": "STRING"}
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

#### 사용 시점 (Trigger)
*   **UI**: 'Smart Gen' 메뉴에서 'Analyze URL' 또는 'Upload File' 버튼 클릭 시 실행.
*   **Flow**: 입력된 정적 데이터를 바탕으로 최초의 'Test Scenario Designer' 역할을 수행하여 Intent 단위의 스텝들을 설계함.


---

## 3. Autonomous Exploration (자율 주행 및 검증 규격)
*   **진입점**: `/exploration/step`
*   **모델**: 지연 속도를 고려하여 `flash` 모델 선호.

### 3.1. Full Step Prompt (단계별 결정 프롬프트)
```text
You are a Self-Driving Browser Agent.
Goal: {req.goal}
Persona Context: {req.persona_context}
User's Latest Feedback / Instruction: {req.user_feedback}

My Context: {user_context_str}

Current Page: {state['title']} ({state['url']})
UI Structure (Simplified HTML/XML): {state['html_structure']}

History: {req.history}

Task: Determine the NEXT interaction to move towards the goal.

[CRITICAL RULES for Action Selection]
1. LOADING WAIT: 3-5초 대기 액션 허용.
2. STUCK PREVENTION: 알 수 없는 화면에서는 'Failed' 처리.
3. SCROLLING: 목표 요소가 보이지 않으면 'scroll' 액션 사용.
4. LOGIN: ID/PW 입력 우선. {{USERNAME}}, {{PASSWORD}} 플레이스홀더 사용 가능.
5. MULTI-STEP GOALS: 최종 단계까지 'Completed' 지연.
6. APP SELECTORS: 'accessibility_id' 우선, 텍스트 기반 선택자 활용.
7. LANGUAGE: 'thought'와 'description'은 반드시 한국어(한국어)로 작성.
8. ASSERTION PREDICTION (expected_text): 다음 화면에서 나타날 EXACT 문자열 예측.
9. ASSERTION VERIFICATION (actual_observed_text): 현재 화면에서 발견된 이전 단계 성공의 증거(Landmark Landmark) 문자열 추출. (가장 중요)
#### 사용 시점 (Trigger)
*   **UI**: 'Dataset Studio'에서 특정 시나리오를 선택하고 'Generate Synthetic Data' 클릭 시.
*   **Flow**: 해당 시나리오에서 사용할 수 있는 유효(Valid), 무효(Invalid), 보안(Security) 데이터를 생성함.

Safety Instruction:
- Never hallucinate passwords.
- If the field assumes an ID/Email, set action_value to '{{USERNAME}}'.
- If the field assumes a Password, set action_value to '{{PASSWORD}}'.
```

### 3.2. Response Schema (ExplorationStep)
```json
{
  "step_number": "integer",
  "matching_score": "0-100",
  "score_breakdown": {
    "Goal_Alignment": "0-100",
    "Page_Relevance": "0-100",
    "Action_Confidence": "0-100"
  },
  "observation": "현재 화면 관찰 결과 (Landmark 확인 포함)",
  "thought": "동작 수행 근거 및 사고 과정 (한국어 필수)",
  "action_type": "click/type/scroll/wait/finish",
  "action_target": "css_selector (또는 Appium Selector)",
  "action_value": "입력값 (플레이스홀더 포함)",
  "expectation": "동작 후 기대 상황 (Expected Outcome)",
  "expected_text": "다음 화면 예측 문자열 (Next State Assertion)",
  "actual_observed_text": "현재 화면 관찰 문자열 (Previous Step Verification)",
  "description": "사용자 화면용 요약 문구",
  "status": "In-Progress/Completed/Failed"
}
```

#### 사용 시점 (Trigger)
*   **UI**: 'AI Exploration' 메뉴에서 목표(Goal)와 페르소나 설정 후 'Start' 버튼 클릭 시 실행.
*   **Flow**: 'Self-Driving Browser Agent'로서 매 루프마다 현재 화면을 분석하고 다음 행동을 결정하는 실시간 루프로 작동함.


---

## 4. Synthetic Data Generation (테스트 데이터 생성)
*   **진입점**: `/ai/generate-data`

### 4.1. Prompt Logic (데이터 생성 프롬프트)
```text
Act as a Test Data Engineer. Generate synthetic test data for the following test scenarios.
Target Scenarios: {scenarios_text}
Required Data Types: {data_types_text} (VALID, INVALID, SECURITY)

Output Format: JSON Array of Objects with keys: 'field', 'value', 'type', 'description', 'expected_result'.

[Constraints]
1. 'field' should match the input fields mentioned in the scenarios.
2. 'type' should be one of the required data types.
3. 'value' should be realistic and appropriate for the type.
4. 'description' should explain why this value is chosen (e.g., "Valid email format", "SQL Injection pattern").
5. 'expected_result' MUST be an EXACT literal text string (Landmark) that should appear on the screen at the end of the iteration.
   - Do NOT write descriptions or sentences (e.g., "Page title is...").
   - Write ONLY the bit-for-bit text value (e.g., "Welcome", "로그인에 실패하였습니다", "Search Results").
   - For INVALID/SECURITY data, this is usually the specific error message text.
```

### 4.2. Output Schema
```json
[
  {
    "field": "필드명",
    "value": "생성된 값",
    "type": "VALID/INVALID/SECURITY",
    "description": "값 생성 근거",
    "expected_result": "화면에 노출될 실제 정적 텍스트"
  }
]
```

#### 사용 시점 (Trigger)
*   **UI**: 'Dataset Studio'에서 특정 시나리오를 선택하고 'Generate Synthetic Data' 클릭 시 실행.
*   **Flow**: 해당 시나리오에서 사용할 수 있는 유효(Valid), 무효(Invalid), 보안(Security) 데이터를 생성함.


---

## 5. Executive Intelligence Report (경영 리포트 생성)
*   **진입점**: `/exploration/analyze_report`

### 5.1. Prompt Content (분석 프롬프트)
```text
You are a QA Intelligence Analyst. Your task is to write an "Executive QA Intelligence Report" in Markdown format based on the provided test telemetry data.

Context: Project: {req.project_name}, Period: {req.period}
Telemetry Data: Executions: {req.stats.totalRuns}, Pass Rate: {req.stats.passRate}%, Failure Patterns: {req.stats.diagnosis}
Golden Path Status: Tracking stats for Exploration, Generator, Manual, and Step Builder.

Instruction:
Write a professional, concise executive summary in Korean (한국어). The report should include:
1. Executive Summary: QA 건전성 및 단계 평가 (Stable/Needs Attention/Critical)
2. Key Risk Areas: 실패 패턴 분석 및 원인 가설 (Root cause hypothesis)
3. Stability Trends: 성공률 추이 및 허용 수준 평가.
4. Actionable Recommendations: 안정성 개선을 위한 2~3가지 핵심 구체적 권고 사항.

Tone: Professional, analytical, objective.
No introductory text like "Here is the report". Start directly with single # title.
```

#### 사용 시점 (Trigger)
*   **UI**: 'AI Dashboard' 또는 'Reports' 메뉴에서 분석 기간 설정 후 'Generate Intelligence Report' 클릭 시 실행.
*   **Flow**: 누적된 테스트 통계(Telemetry)를 바탕으로 경영층을 위한 인사이트 보고서를 자동 생성함.


---

## 6. AI Workflow Diagrams (LLM-Based Process Flows)

Q-ONE의 AI 서비스는 크게 **시나리오 중심(Scenario-Driven)**과 **목표 중심(Goal-Driven)**이라는 두 가지 워크플로우를 가지며, 이들은 최종적으로 동일한 **Autonomous Agent (Section 3)** 엔진을 공유합니다.

### 6.1. Workflow 1: AI Generator (Scenario-Driven)
```mermaid
graph TD
    A["URL / File / Feature Input"] --> B{{"LLM: Scenario Gen"}}
    B -- "High-level Intents" --> C["Scenario Asset (Title, Steps, Expected)"]
    C --> D["User Update / Approval"]
    D --> E{{"Autonomous Agent"}}
    E -- "Analyze-Act-Verify Loop" --> F["Oracle: Step-by-step UI Validation"]
    F -- "Success Traces" --> G["TestScript Asset (Playwright/Appium Code)"]
    G --> H["Regression Studio (Schedule Execution)"]
```

### 6.2. Workflow 2: AI Exploration (Goal/Persona-Driven)
```mermaid
graph TD
    I["Goal & Persona Input"] --> J{{"Autonomous Agent"}}
    J -- "Analyze-Act-Verify Loop" --> K["Oracle: UI Discovery & Landmark Prediction"]
    K -- "Full Interaction History" --> L["AssetManager: Script Synthesis"]
    L -- "Scenario Extraction" --> M["Scenario Asset"]
    L -- "Code Synthesis" --> N["TestScript Asset"]
    M & N --> O["Enterprise Asset Library"]
```

![AI Workflow Visual Diagram](./images/ai_workflow_diagram.png)

### 6.3. 핵심 차이점 요약 (Key Comparison)
| 구분 | AI Generator (Smart Gen) | AI Exploration (Discovery) |
| :--- | :--- | :--- |
| **출발점** | 설계서, 화면 구조 (정적 분석) | 사용자 목표, 페르소나 (동적 탐색) |
| **핵심 LLM** | Scenario Designer (Section 2) | Self-Driving Agent (Section 3) |
| **에이전트 역할** | 설계된 시나리오가 맞는지 **학습/검증** | 목표를 위해 스스로 **경로 탐색** |
| **주요 가치** | 기획/설계 기반의 정밀한 테스트 생성 | 발견되지 않은 결함 및 사용자 행동 탐색 |

---

## 7. AI Fallback Service (Self-Healing)
*   **파일**: `fallback_service.py`
*   **목적**: 표준 자동화 스텝 실패 시, Vision AI가 개입하여 우회 경로를 찾고 목표를 달성함.

### 7.1. Vision-AI Fallback Prompt
```text
You are a 'Self-Healing' Vision-AI Testing Agent.
Goal: {goal}
Platform: {platform}
Current Page: {title} ({current_url})
Context: {cred_context} / {persona_str}

Previous Steps: {history_summary}
Simplified UI Structure (XML/HTML): {xml_structure}

---
VISION FALLBACK INSTRUCTIONS:
1. A screenshot of the current screen is attached.
2. IF you see an important element (button, icon, input) in the image that is NOT listed in the UI Structure (XML), you MUST try to interact with it anyway.
3. For 'action_target', you can use the literal text you see, a coordinate-based description, or a simple ID.
4. Focus on ACHIEVEMENT OF THE GOAL. If the automation tree is broken, use your visual reasoning to bypass it.
```

### 7.2. Output Schema
```json
{
    "thought": "이유 및 전략 상세 (Korean)",
    "action_type": "click/type/scroll/wait/finish",
    "action_target": "CSS/XPath/Text/ID",
    "action_value": "text to type",
    "description": "동작 요약 (Korean)",
    "status": "In-Progress/Completed/Failed"
}
```

#### 사용 시점 (Trigger)
*   **UI/Config**: 테스트 실행(Run) 설정에서 'Enable AI Fallback' 또는 'Self-Healing' 옵션이 활성화된 경우.
*   **Flow**: 시나리오 기반의 일반 실행(Playwright/Appium)이 모든 리트라이 횟수를 소진하고도 실패했을 때, 백엔드에서 원인 해결 및 목표 달성을 위해 최후 수단으로 자동 트리거됨.


---

## 8. AI Script Generator (Playwright Code Synthesis)
*   **진입점**: `/scripts/generate`
*   **목적**: 시나리오 자산을 실행 가능한 Pytest/Playwright 코드로 변환.

### 8.1. Expert Automation Engineer Prompt
```text
You are an Expert playwright Automation Engineer.
Convert the following Test Scenarios into a flexible, robust Playwright (Python) Test Script.

PROJECT CONTEXT: {request.projectContext}
BASE URLS: {base_urls}
USER PERSONA: {request.persona}

SCENARIOS TO IMPLEMENT: {scenarios_json}

[Coding Standards]
1. Use 'playwright.sync_api' and 'pytest' style.
2. Use Robust Locators (ID > Name > TestId > Text).
3. IF 'selectors' field is provided in the scenario, USE THEM directly.
4. Add comprehensive assertions (Expected Result 기반).
```

### 8.2. Output Schema
```json
{
    "code": "import pytest...",
    "tags": ["tag1", "tag2"]
}
```

#### 사용 시점 (Trigger)
*   **UI**: 시나리오 상세 보기 또는 리스트에서 'Code Generate' 클릭 시 실행.
*   **Flow**: 정적으로 정의된 시나리오 문서를 실행 가능한 Python Playwright 코드로 변환함.


---

## 9. AI Auto-Categorization (Taxonomy Expert)
*   **파일**: `asset_manager.py`
*   **목적**: 생성된 테스트 자산을 프로젝트의 기존 카테고리 체계에 맞게 자동 분류.

### 9.1. QA Taxonomy Expert Prompt
```text
You are a QA Taxonomy Expert.
Target Project Category List: [{cats_str}]

Exploration Goal: {goal}
Executed Steps: {steps_summary}

Based on the goal and steps, assign exactly ONE category from the provided list that best fits this test scenario.
If none fit perfectly, pick 'Common' or the closest match.

Return ONLY the name of the category.
```

#### 사용 시점 (Trigger)
*   **UI/Internal**: 'AI Exploration' 탐색 종료 후 결과물을 'Save/Assetize' (자산화) 하는 시점.
*   **Flow**: 탐색된 목표와 전체 스텝을 분석하여 프로젝트의 기존 카테고리 트리(Project Taxonomy) 중 가장 적합한 위치를 백엔드에서 자동 추천하고 할당함.

