# Q-ONE 핵심 기능 명세 (Core Features)

이 문서는 Q-ONE 프로젝트의 주요 아키텍처 및 핵심 기능 명세를 정의합니다. AI 에이전트는 코드 작성 및 로직 수정 시 항상 이 문서를 최우선으로 참고하여 프로젝트 방향성을 유지해야 합니다.

---

## 1. Agent Control Center (에이전트 컨트롤 센터)

Agent Control Center(Main Console)는 Q-ONE의 모든 테스팅 역량이 집결된 대시보드이자, 사용자가 AI 에이전트에게 미션을 하달하는 **중앙 통제 데크(Cockpit)**입니다. 미션 수립부터 실행 로그 관제, 품질 지능 분석까지 하나의 통합 뷰에서 수행합니다.

### 1.1. Mission Orchestrator (지능형 미션 오케스트레이터)
*   **스마트 의도 해석 (Smart Intent Interpretation)**: "결제 시스템 테스트 후 결과 보고해"와 같은 복합 자연어에서 4대 핵심 의도(Testing, Functional, Reporting, Retry)를 정밀하게 추출하고 실행 계획을 수립합니다.
*   **연차적 미션 체이닝 (Sequential Mission Chaining)**: "이후(then)", "후(after)" 등의 키워드를 분석하여 여러 에이전트의 작업을 논리적인 순서로 오케스트레이션합니다.
*   **전략적 에이전트 배정**: 수립된 미션의 성격에 맞춰 Testing 에이전트(검증), Defect 에이전트(복구/동기화), Reporting 에이전트(통찰 요약)를 최적으로 배치합니다.

### 1.2. Mission Control Sidebar (실시간 병렬 관제)
*   **Execution Timeline (로그 스트리밍)**: 미션 수행 과정을 세로형 타임라인으로 시각화하며, 에이전트의 행동(Action), 판단(Thought), 그리고 실시간 로그를 스트리밍합니다.
*   **Interactive Insights**: 실행 중 생성된 AI 분석 결과를 사이드바 내에서 즉시 확인하거나, 'X' 버튼을 통해 관제 영역을 유연하게 온/오프할 수 있습니다.
*   **Sidebar Width Optimization**: 대용량 로그 확인이 용이하도록 확장된 너비(500px)와 가독성 높은 UI 테마를 제공합니다.

### 1.3. Agent Fleet Monitoring (에이전트 군단 모니터링)
*   **Real-time Agent Status**: 헤더 영역에서 Testing, Defect, Reporting 에이전트의 가동 상태를 직관적인 아이콘과 애니메이션으로 확인합니다.
*   **Contextual Alignment**: 수행 중인 미션의 단계(Step)와 주체 에이전트를 유기적으로 연결하여 관제의 투명성을 보장합니다.

### 1.4. Decision Center 2.0 & Intelligence HUD (통합 의사 결정 센터)
*   **Triple Stream Management (3대 관리 체계)**:
    1.  **Pending Approvals (Generator)**: AI가 자동 생성한 시나리오 초안의 승인 대기 건 실시간 관리.
    2.  **Pending Heals (Defect)**: 자율 복구(Self-healing)가 필요한 실패 건의 추적 및 제어.
    3.  **Active Defects (Jira Sync)**: 지라 등록 대기 중인 결함 건의 통합 동기화 센터.
*   **Intelligence HUD (Single Source of Truth)**:
    *   **Strict Metric Sync**: 대시보드 위젯 및 결함 관리 리스트 간의 100% 일치된 데이터(Active Defects 건수 등)를 실시간 투영합니다.
    *   **Fleet Stability Score**: 전체 테스트 자산의 건강 상태를 정량화된 점수로 산출하여 제공합니다.

---

## 2. Knowledge Repo (지능형 지식 저장소)

Knowledge Repo는 테스트 시나리오 생성을 위한 **동적 도메인 지식(RAG)**과 **브라우징 기반 네비게이션 맵**을 통합 관리하는 중앙 지식 허브입니다. 파편화된 문서와 웹 실제 구조를 데이터화하여 AI 에이전트가 더 정밀하게 시나리오를 설계할 수 있도록 "지능의 원천" 역할을 수행합니다.

### 2.1. Document Repository (지식 문서 엔진)
*   **지원 포맷**: PDF, Excel(XLSX, XLS) 명세서를 분석하여 테스트 지식으로 변환합니다. (PPTX, Word 등은 순차적 확장 예정)
*   **지능형 구조 분석 및 정규화**: 문서 내의 화면명, 구분, 경로 키워드를 식별하여 `KnowledgeItem` 단위로 지식을 구조화하고 계층형 리포지토리에 등록합니다.
*   **Column-Based Precision Extraction (컬럼 기반 정밀 추출)**: PDF 내의 'Description(비고)' 등 주요 텍스트 영역을 좌표 기반으로 감지하여 추출함으로써, 표 구조 내의 복잡한 텍스트도 컨텍스트 손실 없이 포집합니다.
*   **Flexible Metadata Mapping**: 사용자가 문서의 컬럼 명칭과 시스템 필드(기능명, 설명 등)를 자유롭게 연결할 수 있는 커스텀 매핑 룰을 제공합니다.

### 2.2. Action Flow Map (UI 탐색 및 시각화)
*   **Structural URL Crawling**: 타겟 URL을 기반으로 **UI 탐색 엔진(Action Flow Crawler)**이 사이트 구조를 분석하며 인터랙티브 요소(버튼, 링크 등)를 기계적으로 맵핑합니다. (Non-AI 기반의 결정론적 탐색)
*   **Hierarchical Tree Mapping**: 화면 간의 관계를 루트(Root)부터 하위 노드까지 트리 구조로 시각화하여 전체 서비스의 Action Flow를 한눈에 파악하게 합니다.
*   **Incremental Expansion (증분 확장)**: 이미 생성된 맵에서 특정 노드를 선택하여 +1 Depth씩 추가로 확장하고 기존 맵에 병합(Merge)하는 연속적인 맵 고도화 프로세스를 지원합니다.
*   **Actionable Assets**: 생성된 맵 노드는 `AI Generator`의 핵심 컨텍스트로 활용되어, 실제 UI 구조와 100% 일치하는 테스트 시나리오 설계의 기반이 됩니다.

---

## 3. AI Generator (시나리오 자동 생성)

AI Generator는 사용자의 요구사항이나 앱/웹 구조를 분석하여 **의도 기반(Intent-Based)** 테스트 시나리오를 자동 생성하는 핵심 모듈입니다. 구현 종속적인 스텝(예: "특정 버튼 클릭")이 아닌, High-Level의 비즈니스 목적(예: "관리자 인증 수행")을 중심으로 시나리오를 구성하여 자율 검증(Auto-Verification) 에이전트가 유연하게 동작할 수 있도록 합니다.

모든 시나리오는 생성 시 **자동으로 해당 도메인의 분과(Category)에 매핑**되며, 사용자는 생성된 **초안(Draft)을 직접 편집 및 수정**할 수 있습니다.

시나리오 생성은 다음 4가지 핵심 소스, **테스팅 페르소나(Persona)**, 그리고 이들의 **복합 조합(Hybrid Mode)**을 통해 구동됩니다.

### 3.1. 지식 저장소 기반 (Knowledge Repo / RAG)
*   **목적**: 프로젝트의 중앙 지식 저장소(Knowledge Repo)에 등록된 기획서, 정책서, 매뉴얼 등의 데이터를 바탕으로 비즈니스 로직에 부합하는 시나리오 생성.
*   **핵심 기능**:
    1.  **계층형 선택(Hierarchy Selection)**: 도메인 > 분과(Category) > 문서 단위로 구성된 트리 구조에서 특정 지식 항목들을 정밀하게 선택하여 생성 컨텍스트로 주입합니다.
    2.  **지능형 컨텍스트 병합**: 선택된 여러 지식 항목(KnowledgeItems)의 내용을 실시간으로 요약 및 병합하여 LLM의 분석 정밀도를 높입니다.

### 3.2. 액션 플로우 맵 기반 (Action Flow Map / Browsing)
*   **목적**: UI 탐색 엔진이 추출한 실제 서비스의 구조(Navigation Flow)를 기반으로, 화면 간의 이동 및 인터랙션 중심의 시나리오 생성.
*   **핵심 기능**:
    1.  **Map-to-Scenario Reasoning**: 이미 구축된 네비게이션 맵의 모든 노드와 인터랙티브 요소를 LLM이 분석하여, 실제 구현된 환경과 일치하는 실전 테스트 케이스를 설계합니다.
    2.  **Selector Integrity**: 맵에 기록된 실제 CSS/XPath Selector를 시나리오 내의 로케이터 정보로 직접 주입하여 AI 에이전트의 실행 정확도를 극대화합니다.

### 3.3. 직접 업로드 기반 (Upload / On-demand)
*   **목적**: 저장소에 등록되지 않은 최신 이미지(스크린샷, 와이어프레임)나 텍스트 문서를 즉시 업로드하여 특정 요건에 대한 시나리오를 신속하게 생성.
*   **핵심 동작 흐름**:
    1.  멀티모달(Vision) 분석을 통해 이미지 내의 UI 요소와 텍스트를 파싱합니다.
    2.  기존 시나리오와의 연관성을 분석하여 신규 케이스 생성 또는 기존 시나리오 갱신 방향을 제안합니다.

### 3.4. 테스팅 페르소나 기반 (Persona-Driven Context)
*   **목적**: 선택된 페르소나의 역할(초보자, 전문가, 관리자 등)과 테스트 목표를 시나리오 설계 단계에서 직접 반영.
*   **핵심 기능**:
    1.  **지능형 스텝 설계**: '초보자'는 상세한 가이드를 포함한 스텝을, '전문가'는 핵심 기능 위주의 정밀한 엣지 케이스를 생성하도록 AI의 설계 방식을 조정합니다.
    2.  **페르소나별 데이터 추천**: 페르소나의 성향에 맞는 테스트 데이터(Input Data)를 우선적으로 제안합니다.

### 3.5. 복합 조건 및 전략 (Hybrid Mode & Strategy)
*   **복합 소스 조합**: 지식 저장소의 정책 데이터, 액션 맵의 구조 데이터, 페르소나의 정체성을 동시에 결합하여 초고정밀 시나리오를 생성합니다.
*   **테스팅 전략 주입**: 메인 기능(Main), 예외 처리(Negative), 데이터 변이(Data), 사용자 경험(UX) 등 AI의 생성 전략을 지정하여 목적에 특화된 시나리오 세트를 도출합니다.

### 3.6. Auto-Verification Agent (자율 검증 에이전트)
*   **목적**: 설계된 고준위 시나리오가 실제 UI 환경에서 정상 작동하는지 AI 에이전트가 직접 브라우징하여 확증.
*   **핵심 기능**:
    1.  **Fidelity Check**: 시나리오의 각 단계를 순차적으로 수행하며, 예상 결과(Expected Result)와 실제 화면의 일치 여부를 판별합니다.
    2.  **Landmark Extraction**: 검증 성공의 증거가 되는 화면 내 실제 텍스트(Landmark)를 자동 추출하여 테스트 자산의 신뢰도를 높입니다.
    3.  **Self-Correction**: 검증 중 단순한 Selector 변경 등은 AI가 스스로 판단하여 최적의 경로로 보정하여 검증을 완수합니다.

---

## 4. AI Agent Lab (AI 에이전트 랩)

AI Agent Lab(기존 AI Exploration)은 사용자의 지시에 따라 AI 에이전트가 브라우저를 직접 제어하며 실시간으로 소통하는 Q-ONE의 핵심 대화형 탐색 모듈입니다. 'Comm Link'를 통한 리얼타임 인터랙션과 'Agentic Trace'를 통한 투명한 사고 과정 공유를 통해, 단순한 자동화를 넘어 에이전트와의 협업 경험을 제공합니다.

### 4.1. Agentic Command Center (40/60 Split UI)
*   **Comm Link (Left 40%)**: 사용자(Commander)와 AI 에이전트 간의 대화 채널입니다. 에이전트의 현재 사고 상태(Thought)를 공유받고, 실시간으로 추가 명령을 하달할 수 있습니다.
*   **Agentic Trace (Right 60%)**: 에이전트의 모든 실행 단계(Step)를 시각화합니다. 각 단계의 매칭 점수, 스크린샷, 액션 상세를 실시간으로 추적하며, 특정 시점으로의 '수정 및 재시도(Edit & Retry)' 기능을 지원합니다.

### 4.2. Real-time Steering & Feedback (실시간 조향 및 피드백)
*   **Sticky Instruction Bar**: 세션 진행 중 언제든지 하단의 고정 입력창을 통해 에이전트의 판단을 정정하거나 새로운 탐색 목표를 제시할 수 있습니다.
*   **Live View (Visual Monitor)**: 에이전트가 현재 보고 있는 화면을 실시간 레이어로 모니터링할 수 있으며, 실제 브라우저와 1:1로 동기화된 시각적 컨텍스트를 제공합니다.

### 4.3. Human-in-the-Loop Loop (하이브리드 제어 루프)
*   **Interactive Decision Making**: 에이전트가 탐색 중 모호한 상황에 직면하면 사용자에게 질문을 던지며, 사용자의 응답은 즉시 다음 액션 결정의 핵심 컨텍스트로 주입됩니다.
*   **Manual Override (Edit & Retry)**: AI가 결정한 특정 스텝이 의도와 다를 경우, 해당 스텝을 즉시 수정하거나 그 이후의 스텝들을 삭제하고 새로운 경로로 재실행할 수 있습니다.

### 4.4. Mission Control & Termination (미션 제어)
*   **Stop Mission (긴급 중단)**: 에이전트가 의도와 다른 방향으로 탐색을 진행하거나 루프가 길어질 경우, 사용자가 즉시 세션을 중단하고 상태를 동결할 수 있습니다.
*   **Resilient Recovery**: 네트워크 지연이나 응답 정지 시 60초 타임아웃 및 자동 복구 안내를 통해 세션의 연속성을 보장합니다.

### 4.5. Instant Assetization (즉시 자산화)
*   **Save as Asset**: 성공적으로 완료된 탐색 미션은 'Save as Asset' 버튼 클릭 한 번으로 `Test Asset`으로 변환되어 Asset Library에 등록됩니다.
*   **Context Inheritance**: 탐색 시 사용된 목표(Goal), 페르소나, 그리고 다듬어진 실행 단계들이 자산의 핵심 로직으로 자동 저장됩니다.

---

## 5. Step Flow (룰 기반 테스트 케이스 생성)

Step Flow는 AI의 자율 탐색 대신 사용자가 직접 브라우저나 앱의 동작 스텝을 정의하여 정밀한 테스트 시나리오를 구성하는 모듈입니다. 100% 사용자의 제어 하에 동작하며, 복잡한 비즈니스 로직이나 정확한 절차 검증이 필요한 경우에 최적화되어 있습니다.

### 5.1. Multi-Platform Inspector (라이브 인스펙터)
*   **실시간 요소 추출**: WEB(Playwright) 및 APP(Appium) 환경의 라이브 화면을 인스펙터를 통해 실시간으로 탐색하고, 클릭/입력 등의 세부 동작을 수행할 요소를 즉시 추출합니다.
*   **스텝 즉시 구성**: 인스펙터로 선택한 요소는 즉시 하나의 테스트 스텝(Action & Selector)으로 변환되어 시퀀스에 추가됩니다.

### 5.2. 직접 제어 기반의 신뢰성 (Precision & Control)
*   **No-AI 실행**: AI의 판단에 의존하지 않고 사용자가 정의한 룰(Rule)에 따라 실행되므로, 실행 결과의 일관성과 재현성이 매우 높습니다.
*   **복합 동작 설계**: 단순 클릭/입력 외에도 화면 대기, 조건부 점프, 텍스트 검증(Assertion) 등 정교한 테스트 로직을 구성할 수 있습니다.

### 5.3. 자산화 및 통합 관리 (Assetization)
*   **자산 라이브러리 연동**: 구성된 Step Flow 시나리오는 저장 시 즉시 `Test Asset`(Emerald Theme)으로 변환되어 Asset Library에 등록됩니다.
*   **범용 실행 엔진**: 생성된 자산은 AI로 생성된 자산과 동일하게 메인 콘솔에서 실행하거나 스케줄러에 등록하여 무인 자동화 테스트에 활용할 수 있습니다.

---

## 6. Asset Library (지능형 테스트 자산 관리)

Asset Library는 Q-ONE의 파이프라인(AI Generator, Step Flow 및 시나리오 상세화 과정)을 통해 생성된 모든 테스트 자산을 중앙에서 관리, 검토 및 최적화하는 핵심 Hub입니다. 단순한 리스트 표시를 넘어, 자산의 '지능(Intelligence)'을 직관적으로 제어할 수 있는 Unified Center 역할을 수행합니다.

### 6.1. Unified Intelligence Center (통합 지능 제어 센터)
모든 테스트 자산(AI 기반 자산 및 Step Flow 자산)은 단일화된 Intelligence Center를 통해 관리됩니다. 이를 통해 자산의 생성 배경부터 실행 세부 정보까지 한눈에 파악할 수 있습니다.
*   **Connected Scenario**: 해당 자산이 생성된 기반이 되는 비즈니스 시나리오 및 기획 의도를 실시간으로 조회하여 테스트의 타당성을 즉시 검토합니다.
*   **Step Intelligence**: 자북 에이전트가 탐색하며 생성한 세부 Step들을 직접 확인하고, 필요 시 Selector 및 Action을 정밀하게 튜닝할 수 있는 편집 환경을 제공합니다.
*   **Execution Context (Persona & Dataset)**:
    *   **Persona**: 테스트 수행 시 어떤 성향(초보 사용자, 전문가 등)으로 행동할지 정의된 가상 인격체를 관리합니다.
    *   **Dataset Studio**: 스크립트의 로직을 유지하면서도 다양한 변수(유효/예외 데이터)를 동적으로 치환하여 테스트 커버리지를 극대화합니다.

### 6.2. Dynamic Theming 기반의 자산 직관화
자산의 성격에 따라 시각적 테마를 동적으로 적용하여 사용자가 자산의 원천과 특성을 즉각적으로 인지할 수 있도록 합니다.
*   **Emerald Theme (Step Flow)**: 사용자가 직접 또는 Step Recorder를 통해 생성한 정형화된 절차 중심의 자산.
*   **Indigo Theme (AI Generated / Manual)**: AI의 자율 탐색을 통해 생성되었거나 실험적인 성격의 자산.

### 6.3. 자율 운영 정책 제어 (Autonomous Policy)
자산별로 서비스의 특성에 맞는 실행 전략을 개별적으로 설정하여 테스트의 신뢰도를 향상시킵니다.
*   **Self Healing Mode (셀프 힐링)**: UI 변경 등으로 인해 테스트 실패 시, AI 에이전트가 실시간으로 화면을 재분석하여 대체 경로를 찾거나 요소를 갱신하여 테스트를 완수하도록 하는 자율 복구 기능을 제어합니다.
*   **Retry Policy**: 일시적인 네트워크 지연이나 불안정한 환경에 대비하여 실패 시 최대 재시도 횟수를 정의합니다.

### 6.4. 전략적 필터링 및 관리 (Filter & Search)
대규모로 관리되는 테스트 자산을 빠르게 식별하기 위해 고도화된 필터링 체계를 제공합니다.
*   **Origin Filter**: AI 엔진 생성 자산과 Step Flow 자산을 분리하여 관리.
*   **Platform Context**: Web(Playwright) 및 App(Appium) 플랫폼별 자산 구분.
*   **Flexible Favorites**: 즐겨찾기 기능을 Origin/Platform 필터와 조합하여 개인화된 작업 뷰 구축 가능.

### 6.5. Asset Business Priority (비즈니스 중요도)
개별 테스트 자산이 비즈니스 로직에서 가지는 고유한 가치를 정의합니다.
*   **P0 (Critical)**: 정기적/상시 검증이 필요한 핵심 비즈니스 로직 (결함 시 서비스 중단급).
*   **P1 (High)**: 주요 기능 및 사용자 핵심 흐름 (결함 시 서비스 기능 제약).
*   **P2 (Normal)**: 일반적인 기능 검증 (Default).
*   **P3 (Low)**: 부가 기능 및 UI 마이너 케이스 검증.
*   **Usage**: 이 우선순위는 **11.4. Defect Management**의 `Importance Score` 계산 시 'Priority Score'로 활용되어 조치 시급성을 정량화합니다.

---

## 7. DataSet Studio (대용량 테스트 데이터 생성 및 관리)

DataSet Studio는 특정 테스트 자산(Test Asset)에 결합될 동적 데이터를 생성하고 관리하는 독립적인 데이터 엔지니어링 메뉴입니다. 자산이 생성된 방식(AI Generator, Step Flow 등)에 관계없이 모든 자산을 대상으로 매트릭스 테스팅을 위한 변수 셋을 구축할 수 있습니다.

### 7.1. 범용 데이터 엔진 (Universal Data Engine)
*   **자재/기법 종속성 제거**: AI Generator의 파이프라인 중 하나였던 단계를 독립 메뉴로 승격하여, 수동으로 만든 Step Flow 자산이나 외부에서 가져온 스크립트에도 즉시 대량의 데이터를 결합할 수 있습니다.
*   **분별력 있는 데이터 생성**: LLM을 활용하여 유효 데이터뿐만 아니라, 경계값(Edge Case), 보안 취약점 공격용 데이터(SQL Injection, XSS 등), 비정상 입력(Invalid) 등을 자동으로 생성합니다.

### 7.2. 자산-데이터 매핑 (Asset-Data Mapping)
*   **필드 자동 추출**: 선택한 자산의 코드를 분석하여 변수화 가능한 필드(예: `{{id}}`, `{{password}}`)를 자동으로 추출합니다.
*   **실행 시점 결합**: 생성된 데이터 셋은 스케줄러나 메인 콘솔에서 실행 시점에 스크립트 로직과 결합되어, 코드 수정 없이 수백 가지 케이스를 동시에 검증하게 합니다.

---

## 8. Design Center (중앙 설계 센터)

Design Center는 테스트 자동화에 필요한 모든 **메타데이터와 리소스(Persona, Object, Action, Global Data)**를 설계하고 관리하는 핵심 Hub입니다. 개별 프로젝트에 종속되거나 전역(Global)으로 공유되는 자산을 체계적으로 구축하여 AI 테스팅의 품질과 재사용성을 극대화합니다.

### 8.1. Persona Manager (지능형 가상 인격체 관리)
테스트를 수행할 AI 에이전트의 성격과 행동 양식을 정의합니다.
*   **Persona Identification**: 이름, 숙련도(Novice/Expert), 속도(Slow/Fast)를 설정하여 실제 사용자와 유사한 행동 패턴을 유도합니다.
*   **Behavioral Logic (AI Heuristics)**: 특정 비즈니스 상황에서 지켜야 할 "행동 강령"을 주입합니다. (예: "로그아웃 전 반드시 장바구니 리스트를 확인하라")
*   **Domain Filtering**: 프로젝트 도메인(Finance, Shopping 등)에 최적화된 페르소나를 우선 노출하여 테스트 맥락의 일관성을 유지합니다.
*   **Global Persona Scope**: 전사적으로 공유되는 '공용 페르소나'와 프로젝트 전용 페르소나를 구분하여 관리합니다.

### 8.2. Object Repository (오브젝트 저장소)
UI 구성 요소(Selector)를 자산화하여 관리합니다.
*   **Centralized Selector Management**: 화면의 요소들을 개별 스크립트에 하드코딩하지 않고, 중앙 저장소에서 이름(ID) 기반으로 관리하여 UI 변경 시 유지보수 비용을 최소화합니다.
*   **Platform Specificity**: Web(ID, CSS, XPath) 및 Mobile App(Accessibility ID, Resource ID) 플랫폼별 최적화된 선택자를 지원합니다.
*   **Visual Card View**: 등록된 오브젝트들을 카드 형태로 직관적으로 확인하고 필터링할 수 있는 UI를 제공합니다.

### 8.3. Action Library (재사용 가능한 액션 꾸러미)
반복되는 동작 시퀀스를 함수화(Action)하여 조립 가능한 형태로 관리합니다.
*   **Modular Action Design**: '로그인', '주문 결제'와 같이 빈번하게 일어나는 동작들을 모듈화하여 새로운 시나리오 작성 시 간단한 선택만으로 스텝을 구성합니다.
*   **Object Linking**: 각 액션이 어떤 오브젝트를 대상으로 동작하는지 연계 정보를 관리하여 데이터 흐름을 명확히 합니다.

### 8.4. Global Data (중앙 공유 데이터 세트)
여러 시나리오에서 공동으로 사용하는 기초 데이터를 관리합니다.
*   **Schema-based Table Structure**: 사용자가 직접 컬럼(Key)을 정의하고 여러 행(Record)의 데이터를 입력할 수 있는 유연한 테이블 구조를 제공합니다.
*   **Context-Aware Data**: 유효(Valid), 비유효(Invalid), 보안(Security) 등 테스트 의도에 맞춘 데이터셋을 미리 구축하여 필요할 때 즉시 가져다 쓸 수 있습니다.
*   **Clear Initialization**: 새 데이터셋 생성 시 이전 상태가 남지 않도록 완벽하게 초기화된 작업 환경을 제공하여 데이터 무결성을 보장합니다.

---

## 9. Smart Scheduler (지능형 테스트 오케스트레이션)

Smart Scheduler는 정기적인 배치 실행부터 배포 연계형 실행까지, 테스트 자산의 자율적 운영 환경을 정의하는 핵심 오케스트레이션 엔진입니다. 단순한 반복 실행을 넘어 장애 상황에 대한 지능적인 전파 정책을 수립합니다.

### 9.1. Autonomous Trigger Strategy (자율 실행 전략)
*   **Scheduled**: 표준 크론(Cron) 표현식 및 프리셋을 통해 일간/주간/월간 단위의 정기적인 회귀 테스트를 수행합니다.
*   **Post-Deployment**: CI/CD 파이프라인의 Webhook과 연동되어, 새로운 코드가 배포된 직후 검증 테스트를 즉시 트리거합니다.

### 9.2. Priority-Based Preemption (우선순위 및 자원 선점)
작업의 중요도에 따라 실행 우선순위를 고도화하여 최적의 리소스 분배를 실현합니다.
*   **Critical Tier**: 고위험/핵심 비즈니스 로직을 대상으로 하며, 리소스 부족 시 낮은 우선순위의 작업을 중단하거나 큐의 맨 앞으로 이동시키는 **실전 선점(Execution Preemption)** 로직을 적용합니다.
*   **High / Normal Tier**: 일반적인 품질 관리 및 루틴 테스트를 위해 순차적으로 리소스를 할당받습니다.
*   **Policy Differentiation**: 스케줄 우선순위는 여러 자산을 포함하는 **'배치 작업(Batch Job)' 단위의 운영 정책**입니다. 개별 자산의 비즈니스 등급(P0-P3)과는 별개로 설정되어, 리소스 배분 효율성을 제어하는 데 목적을 둡니다.

### 9.3. Incident Orchestration Policy (장애 대응 정책)
테스트 실패 시 단순 로그 기록을 넘어 실시간 장애 전파와 대응 체계를 구축합니다.
*   **Alert Configuration**: Slack, Email, Jira 등 다양한 채널을 통해 장애 상황을 실시간으로 디스패치합니다.
*   **Failure Threshold (임계치)**: 네트워크 지연 등 일시적 오류를 걸러내기 위해 연속 실패 횟수에 따른 알림 발생 시점을 정밀하게 제어합니다.
*   **Policy Strictness**: `Critical Failures Only` 모드를 통해 시스템 중단과 같은 치명적 오류 상황에서만 알림을 집중하여 알림 피로도를 관리합니다.

### 9.4. Integrated Asset Control (통합 자산 제어)
*   **Test Asset Selection**: 자산 라이브러리(`Asset Library`)와 직접 연계되어 여러 시나리오를 하나의 배치 작업으로 묶어 통합 관리합니다.
*   **Search & Filtering**: 수백 개의 배치 작업 중 트리거 유형(Schedule/Deployment) 및 자산 명칭 기반의 고도화된 필터링으로 스케줄 가시성을 확보합니다.

---

## 10. CI/CD Intelligence (배포 연계형 품질 관리)

CI/CD Intelligence(PipelineWatcher)는 개발 파이프라인의 배포 이벤트와 Q-ONE의 테스트 역량을 실시간으로 결합하는 고도화된 품질 관제 모듈입니다. 단순히 테스트를 자동 기동하는 것을 넘어, AI가 배포 컨텍스트를 분석하여 최적의 테스트 자산을 선정하고 품질 공백을 제어합니다.

### 10.1. Real-time Pipeline Feed & Webhook Integration
*   **Multi-Platform Connectivity**: GitHub, Jenkins, GitLab, GitHub Actions 등 주요 CI/CD 도구와의 웹훅 전용 엔드포인트를 제공하여 빌드 상태를 실시간으로 수집합니다.
*   **Build Metadata Tracking**: 버전(Version), 커밋 해시(Commit), 브랜치 정보 및 담당자(Author) 정보를 동기화하여 테스트 결과와 빌드 이력을 정밀하게 매핑합니다.

### 10.2. Autonomous Asset Selection (AI 영향도 분석)
*   **Contextual Deployment Mapping**: AI 에이전트가 배포된 패키지 명칭, 커밋 메시지, 수정된 기능 설명(Description)을 분석하여 `Asset Library` 내에서 가장 연관성이 높은 테스트 자산을 스스로 식별합니다.
*   **Impact-Based Orchestration**: 빌드의 영향도(Impact Scale)를 판단하여 중요도가 높은 배포일 경우 즉각적인 자율 테스트를 기동(Force Restart)하거나 검증 순위를 조정합니다.

### 10.3. Intelligent Coverage Gap Analysis & Proposal
*   **Deployment Delta Analysis**: 현재 실행된 테스트 결과와 배포된 신규 기능 간의 차이점(Gap)을 식별합니다.
*   **Scenario Suggestions**: 식별된 품질 공백을 보완하기 위해 AI가 새로운 테스트 시나리오를 자동으로 설계하여 제안(Suggestion)하며, 사용자는 이를 검토 후 즉시 자산화(Assetization) 할 수 있습니다.

### 10.4. Live Diagnostic Terminal (자율 진단 관제)
*   **Full-Stack Log Streaming**: 빌드 감지(BUILD), AI 분석(AI), 테스트 실행(EXEC), 결과 도출(SUCCESS/ERROR)의 전 과정을 타임라인 형태의 라이브 로그로 투명하게 공개합니다.
*   **Autonomous Orchestration Visibility**: AI가 어떤 근거로 특정 테스트 자산을 선정했는지, 어떤 갭을 발견했는지에 대한 추론 과정을 실시간으로 모니터링할 수 있는 터미널 환경을 제공합니다.

---

## 11. Execution Status (실행 현황 및 모니터링)

Execution Status는 테스트 실행 결과에 대한 실시간 모니터링, 이력 추적 및 결함 관리를 위한 통합 컨트롤 타워입니다. 지능형 대시보드와 정밀한 결함 관리 워크플로우를 통해 품질 상태를 직관적으로 파악하고 조치할 수 있게 합니다.

### 11.1. Intelligence Dashboard (품질 지능 대시보드)
테스트 자산의 실행 안정성을 다각도로 분석하여 유지보수 우선순위를 제안하는 지능형 관제 뷰(Test Dashboard)를 제공합니다.
*   **Asset Stability Board (30일 히트맵)**: 모든 테스트 자산의 지난 30일간 실행 이력을 타임라인 히트맵으로 시각화하여 품질 추이를 한눈에 파악합니다.
*   **지능형 상태 구분**:
    *   **Success (Green)**: 해당 일자의 모든 실행 성공.
    *   **Failed (Red)**: 해당 일자의 모든 실행 실패.
    *   **Partial (Amber)**: 해당 일자에 성공과 실패가 혼재됨. 실패율에 따라 색상 농도를 3단계(Low: ≤30%, Mid: ≤70%, High: >70%)로 차등 적용하여 심각도를 표시합니다.
*   **다차원 필터링 및 검색**: 자산 명칭 검색 및 생성 기원(AI GEN, MANUAL, STEP FLOW)별 필터링 기능을 통해 분석 범위를 정밀하게 제어합니다.

### 11.2. Assets Needing Attention (유지보수 필요 자산)
실행 데이터를 기반으로 AI가 즉각적인 검토나 조치가 필요한 고위험 자산을 자동으로 분류합니다.
*   **Frequent Failures (빈번한 실패)**:
    *   **식별 조건**: 최근 30일 성공률 **70% 미만**.
    *   **목적**: 빈번하게 실패하는 핵심 자산을 식별하여 스크립트 결함 수정이나 서비스 로직 점검을 유도합니다.
*   **Stability Alerts (불안정 알림)**:
    *   **식별 조건**: 성공률 **0% 초과 100% 미만** (성공과 실패가 반복되는 Flaky 자산).
    *   **목적**: 결과가 예측 불가능한 자산들을 성공률이 낮은 순으로 정렬하여, 실행 환경 최적화나 대기 로직 보정이 필요한 대상을 우선적으로 제안합니다.

### 11.3. Execution History (실행 이력 상세)
*   **Full-Stack Traceability**: 모든 실행 건에 대해 비디오, 스크린샷, 콘솔 로그 및 시스템 하드웨어 매트릭스를 연계하여 저장합니다.
*   **Multi-Dimensional Filtering**: 프로젝트, 플랫폼, 실행 트리거(Manual/Schedule/Pipeline), 버전별 다각도 필터링을 지원합니다.

### 11.4. Defect Management (지능형 결함 관리)
단순한 실패 기록 조회를 넘어, AI가 개입하여 결함의 중요도를 판단하고 복구 프로세스를 가이드합니다.

#### **[Active Defects (실질 결함 목록)]**
*   **정의 및 목적**: 모든 자산 중 **최신 실행 결과가 'Failure'인 건**들만 그룹화하여 노출합니다. 이는 과거의 기록이 아닌, **현재 시점에 조치가 필요한 실질적인 문제**들을 식별하는 데 목적이 있습니다.
*   **정렬 기준 (Importance-First)**: 사용자 정의 중요도와 데이터 기반 실패 심각도를 결합한 'Importance Score' 내림차순으로 정렬하여, 어떤 결함을 가장 먼저 검토해야 하는지 가이드합니다.

#### **[Importance Score (중요도 계산 공식)]**
결함의 우선순위를 정량화하기 위해 다음 공식을 사용합니다:
> **Importance Score = (Priority Score × 0.4) + (Failure Rate × 0.3) + (Failure Volume Score × 0.3)**
*   **Priority Score**: 자산의 비즈니스 중요도 (P0=100, P1=70, P2=40, P3=10)
*   **Failure Rate**: 해당 자산의 최근 누적 실패율 (%)
*   **Failure Volume Score**: 실패 발생 횟수 가중치 (실패 횟수 × 10, 최대 100)

#### **[Defect Triage Workflow (결함 조치 워크플로우)]**
결함 식별 시 다음의 단계적 대응 체계를 지원합니다:
1.  **Quick Retry (즉시 확인)**: 코드나 환경 수정 후 즉시 재실행하여 수정 여부를 확증합니다.
2.  **AI Self-Healing (자율 복구)**: UI 변경 등에 의한 실패 시 AI가 화면을 재분석하여 Selector를 자동 보정하고 테스트를 완수합니다.
3.  **Assign to Jira (티켓 발행)**: 조치가 불가능한 결함은 AI 분석 리포트, 스크린샷, 로그를 포함한 Jira 티켓을 즉시 생성하여 담당자에게 할당합니다.

#### **[Healed Assets (복구 완료 내역)]**
AI Self-healing 기능을 통해 성공적으로 복구된 자산들의 목록과 히스토리를 관리합니다.
*   **Detailed Healing Log**: 단순 결과가 아닌 AI의 추론 과정(Thought)을 상세히 기록합니다.
    *   문제가 된 기존 Selector 정보
    *   AI가 분석한 화면 구조 변화 및 판단 근거
    *   **Healed Steps**: 새롭게 보정된 Selector 및 적용 결과

### 11.5. AI-Powered Root Cause Analysis (AI 근본 원인 분석)
실패 시점의 다차원 데이터를 분석하여 사람이 이해할 수 있는 구체적인 실패 원인을 도출합니다.
*   **Technical Analysis**: 실패 시점의 HTML DOM 상태, 브라우저 콘솔 로그, 에러 스택 트레이스를 상호 참조하여 분석합니다.
*   **Visual Insight**: 캡처된 스크린샷의 시각적 요소를 분석하여 Element 오버랩, 가시성 문제 등을 식별합니다.
*   **Actionable Intelligence**: 단순 에러 메시지가 아닌, **Root Cause(근본 원인), AI Thought(추론 과정), Suggestion(해결 제안)**으로 구성된 리포트를 제공하여 Jira 등 외부 시스템으로 즉시 전파합니다.

---

## 12. Analytics & Reports Dashboard (품질 지능 대시보드)

테스트 스크립트의 활용도, 실행 스탯, 결함 분석 정보 등 다각적인 데이터를 하나의 대시보드에서 4개의 핵심 섹션으로 나누어 일관되게 제공합니다.

*   **Test Asset Summary**: 플랫폼별(AI Gen / Step Flow) 보유 자산의 수, 활용도(Utilization), 평균 성공률(Stability), 그리고 각 스크립트별 마지막 검증일 등 전반적인 자산 건강 상태와 파급 효과(Impact) 목록을 보여줍니다.
*   **Execution Summary**: 선택된 기간 동안의 총 실행 건수, 평균 통과율(Pass Rate), CI/CD 등 파이프라인 트리거 건수, 스케줄러 자동 실행 건수 등 시스템의 전반적인 실행 지표 통계를 단일 뷰에서 카드 형태로 가시화합니다.
*   **Defect Summary**:
    *   **Defect Severity Distribution**: 에셋별 비즈니스 중요도(Priority), 실패율, 볼륨 가중치를 결합해 산출된 Importance Score를 기반으로 실패 심각도를 Critical/High/Medium/Low의 4단계 분포로 표시합니다.
    *   **Defect Resolution**: 이슈 해결 워크플로우를 트래킹하여 식별된 에셋들이 Jira에 등록되었는지, AI 자율 복구(Healed)로 수정 완료되었는지, 혹은 미해결(Open) 상태인지의 처리 현황을 요약합니다.
*   **Root Cause Analysis Summary**: 전체 실패 테스트를 에러 원인에 맞춰 4가지 클러스터로 자동 분류 및 요약하는 2x2 카드 뷰를 제공합니다. 발생한 요인별 에셋들을 직관적으로 확인하고, 필요 시 'Investigate' 추론 로그 뷰어를 호출해 실시간으로 에러 스텝을 심층 분석할 수 있습니다. 각 클러스터로 분류되는 세부 판단 지표는 다음과 같습니다.
    *   **Timeout / Performance**: 에러 로그에 `timeout`, `exceeded`, `waiting` 등의 키워드가 포함된 경우. 주로 화면의 로딩 지연이나 서버 응답 지연으로 인해 지정된 시간 내에 대상을 찾지 못하거나 액션이 완료되지 않았을 때 분류됩니다.
    *   **UI / Selector Change**: 에러 로그에 `selector`, `element`, `visible`, `not found`, `clickable`, `intercepted` 등의 키워드가 포함된 경우. 서비스의 UI 개편이나 화면 구조가 변경되어 기존 테스트 자산의 Selector가 노출되지 않거나 다른 요소에 가려졌을 때 분류됩니다.
    *   **Network / API**: 에러 로그에 `network`, `api`, `500`, `refused`, `disconnected`, `socket`, `fetch` 등의 키워드가 포함된 경우. 서버와의 통신 단절, API 호출 실패(5xx 에러) 등 네트워크 인프라 또는 백엔드 서비스 장애가 의심될 때 분류됩니다.
    *   **Logic Error / Assertion**: 위의 3가지 유형에 명확하게 해당하지 않는 모든 논리적 실패 건. 테스트 시나리오 상에서 정의한 조건(Assertion)을 만족시키지 못했거나, 스크립트 상의 Business Logic 결함이 있을 때 기본적으로 이 카테고리로 묶입니다.

#### Export Intelligence (리포트 추출)
대시보드에 나타난 4개의 핵심 요약 섹션과 지능형 분석 결과를 통합하여, 임원진 및 이해관계자 보고용 Executive Report(PDF 등 문서 형태의 뷰)로 깔끔하게 추출할 수 있는 Export 기능을 제공합니다.

---

## 13. Device Farm (디바이스 인프라 관리)

Device Farm은 테스트가 수행되는 실제 하드웨어 자원을 실시간으로 모니터링하고 제어하는 통합 인프라 관리 센터입니다. 분산된 디바이스 노드(Node)들의 상태를 한눈에 파악하고, 원격에서 하드웨어 레벨의 감사 및 제어를 수행합니다.

### 13.1. Real-time Infrastructure Monitoring (실시간 모니터링)
*   **Hardware Health HUD**: 개별 디바이스의 CPU 모델, RAM 용량, 해상도 및 OS 버전을 실시간으로 시각화합니다.
*   **Status Tracking**: 디바이스의 가용 상태(`Available`, `In-Use`, `Offline`)를 추적하며, 특히 `In-Use` 상태일 경우 현재 어떤 프로젝트의 테스트가 수행 중인지 프로젝트 명칭을 즉시 노출합니다.
*   **Connectivity Metrics**: 네트워크 지연 시간(Latency) 및 패킷 손실률(Packet Loss)을 모니터링하여 테스트 환경의 품질을 보장합니다.

### 13.2. Autonomous Terminal Audit (자율 터미널 감사)
*   **Live Log Streaming**: ADB(Android) 및 각 플랫폼 프로토콜을 백엔드와 WebSocket으로 직결하여, 라이브 로그 스트림을 브라우저에서 즉시 확인할 수 있습니다.
*   **Telemetry Analysis**: 서비스 로그뿐만 아니라 시스템(OS) 레벨의 이벤트를 수집하여, 테스트 실패 시 하드웨어적 결함이나 시스템 리소스 부족 여부를 정밀 분석합니다.

### 13.3. Hardware Lifecycle Control (하드웨어 제어)
*   **Remote Node Management**: 디바이스 노드에 대한 강제 연결 해제(Force Disconnect) 및 재연결(Reconnect) 기능을 제공하여, 물리적 접근 없이도 인프라 이상 기동 시 원격 복구를 수행합니다.
*   **Multi-Platform Orchestration**: Android(AOS), iOS, Windows, macOS 등 다양한 운영체제를 단일 인터페이스에서 통합 관리하며, UDID 기반의 고유 식별 체계를 유지합니다.

---

## 14. Admin & User Management (관리자 및 사용자 관리)

Q-ONE은 기업 단위의 계층 구조와 세분화된 권한 체계를 통해 대규모 테스트 인프라를 안정적으로 운영할 수 있는 관리 환경을 제공합니다.

### 14.1. Hierarchical Organization (Q-ONE 계층 구조)
*   **Company (Customer Account)**: 최상위 관리 단위로, 기업별 독립된 데이터 공간과 라이선스/플랜(`Free`, `Pro`, `Enterprise`)을 관리합니다.
*   **Workspace (Project)**: 실제 테스트가 수행되는 작업 단위입니다. 하나의 Company는 여러 개의 Workspace를 가질 수 있으며, 각 Workspace는 독립적인 테스트 자격 증명, 디바이스 구성 및 시나리오를 가집니다.

### 14.2. Multi-Tiered Authorization (사용자 권한 체계)
시스템 전체 및 개별 워크스페이스에 대해 4단계의 역할(Role) 기반 접근 제어(RBAC)를 수행합니다.

#### [Role Definition & Authority Matrix]

| 기능 분류 | 세부 기능 | Admin | Manager | QA Engineer | Viewer |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Workspace & IAM** | 워크스페이스 생성/삭제 | ✅ | ❌ | ❌ | ❌ |
| | 워크스페이스 설정 수정 | ✅ | ✅ | ❌ | ❌ |
| | 사용자 초대 및 권한 관리 | ✅ | ✅ | ❌ | ❌ |
| **Design Center** | 시나리오/테스트 생성 (AI/Step) | ✅ | ✅ | ✅ | ❌ |
| | 테스트 자산 수정/삭제 | ✅ | ✅ | ✅ | ❌ |
| | 자산 승인 (Certification) | ✅ | ✅ | ❌ | ❌ |
| | 오브젝트/데이터셋 등록/수정 | ✅ | ✅ | ✅ | ❌ |
| **Execution** | 테스트 즉시 실행 (Manual/AI) | ✅ | ✅ | ✅ | ❌ |
| | 스케줄 등록 및 수정 | ✅ | ✅ | ✅ | ❌ |
| | 스케줄 활성화/비활성화 | ✅ | ✅ | ✅ | ❌ |
| **Intelligence** | 결과 리포트 및 로그 조회 | ✅ | ✅ | ✅ | ✅ |
| | 분석 리포트 삭제/관리 | ✅ | ✅ | ❌ | ❌ |
| **Device Farm** | 디바이스 상태 모니터링 | ✅ | ✅ | ✅ | ✅ |
| | 실시간 로그 감사 및 제어 | ✅ | ✅ | ✅ | ❌ |

*   **Admin (Customer Admin)**: Company 전체의 테넌트 관리자입니다. 모든 워크스페이스에 대한 전권을 가집니다.
*   **Manager (Project Owner)**: 특정 Workspace의 운영 책임자입니다. 자본적 결정(워크스페이스 삭제)을 제외한 모든 운영 권한을 가집니다.
*   **QA Engineer (Test Developer)**: 실제 테스트 시나리오를 설계하고 운영하는 실무자입니다. 자산 보호(승인된 자산 수정 불가 등)를 제외한 실행 권한을 가집니다.
*   **Viewer (Stakeholder)**: 테스트 실행 결과 및 인프라 상태를 조회할 수 있는 읽기 전용 권한입니다.

### 14.3. User Lifecycle Management (사용자 관리 및 보안)
*   **Secure Authentication**: 이메일 기반의 ID/PW 인증 체계를 제공하며, JWT(JSON Web Token)를 통한 보안 세션 관리를 수행합니다.
*   **Workspace Invitation**: 이메일 초대를 통해 새로운 사용자를 특정 워크스페이스에 즉시 참여시키고 역할을 부여할 수 있습니다.
*   **Self-Service Profile**: 사용자는 자신의 프로필 정보를 관리하고 비밀번호를 직접 수정하여 보안 수준을 유지할 수 있습니다.

---

## 15. Workspace Configuration (워크스페이스 설정 및 관리)

워크스페이스는 테스트가 수행되는 가장 핵심적인 논리적 단위이며, 각 워크스페이스는 독립적인 인프라, 앱 식별 정보 및 조직 체계를 가집니다.

### 15.1. Application Identity & Infrastructure (애플리케이션 식별 및 인프라)
플랫폼 타겟팅부터 실행 환경까지, 테스트 가동을 위한 기술적 기반을 통합 관리하는 블록입니다.

*   **Target Technology Stacks (대상 플랫폼)**: 테스트 에이전트가 구동될 타겟(PC-Web, Mobile-Web, Mobile-App)을 정의하고 활성화합니다.
*   **Platform Identification Metadata (Appium 식별 정보)**: `Mobile-App` 활성화 시, Oracle 에이전트가 글로벌 디바이스 팜에서 타겟 앱을 식별하고 자동 실행하는 데 필요한 `Package Name` (Android), `Bundle Identifier` (iOS) 및 **Version Policy**(특정 빌드 지정을 위한 버전 정책) 등의 핵심 메타데이터를 관리합니다.
*   **Environment Infrastructure (환경별 접속 정보)**: `Development`, `Staging`, `Production` 등 서비스 생애주기별 서버 URL을 매핑합니다. 테스트 실행 시 환경을 선택하면 시나리오 수정 없이 해당 타겟 서버로 자동 라우팅되는 동적 접속 환경을 제공합니다.

### 15.2. Project Taxonomy & Organization (프로젝트 계층 및 조직화)
수천 개의 테스트 자산을 비즈니스 로직에 따라 체계적으로 분류하고 관리 책임을 정의하는 블록입니다.

*   **Module Categories (계층형 카테고리)**: 업무 단위별 부모-자식(Parent-Child) 관계를 가지는 카테고리를 정의하여 테스트 자산의 가시성을 확보합니다.
*   **Domain Responsibility Mapping**: 각 카테고리별로 담당 관리자(Manager)를 지정하여, 해당 도메인의 테스트 품질 관리 및 자산 승인에 대한 책임 소재를 명확히 합니다.

---

## 16. Implementation Status (구현 현황 요약)

| 구분 | 주요 기능 | 구현 상태 | 비고 |
| :--- | :--- | :---: | :--- |
| **Knowledge Repo** | Document Repository (RAG) | ✅ | 다중 포맷 파싱 및 AI 기반 데이터 추출 완료 |
| | Action Flow Map | ✅ | 구조 분석 기반 자율 탐색 및 트리 시각화 완료 |
| **AI Generator** | Multi-Source Scenario Gen | ✅ | Map/Knowledge/Upload 복합 생성 지원 |
| **Execution Status** | Intelligence Dashboard | ✅ | Re-chart 기반 시각화 완료 |
| | Execution History | ✅ | 상세 로그 및 필터링 지원 |
| | Defect Management (Active/Healed) | ✅ | 중요도 알고리즘 및 복구 연동 완료 |
| | AI-Powered Failure Analysis (RCA) | ✅ | 근본 원인 분석 및 조치 제안 지원 |
| | Jira Integration | ✅ | Wiki Markup 기반 상세 리포팅 지원 |
| **계층 구조** | Company / Workspace 구조 | ✅ | DB 모델 및 API 연동 완료 |
| | 워크스페이스 간 자산 이동 | ❌ | 향후 지원 예정 |
| **사용자 관리** | 이메일/비밀번호 로그인 | ✅ | JWT 기반 인증 적용 |
| | 비밀번호 직접 수정 | ✅ | `/me/password` API 구현 |
| | 사용자 초대 및 삭제 | ✅ | 프로젝트별 초대 및 Soft Delete 지원 |
| | 소셜 로그인 (SSO) | ❌ | 구글/깃허브 연동 예정 |
| **권한 관리** | 역할 기반 접근 제어(RBAC) | ✅ | 상세 권한 매트릭스 정의 및 적용 완료 |
| | 세부 기능별 권한 커스텀 | ❌ | 역할별 고정 매트릭스 사용 중 |
| **운영 설정** | 서비스 플랜 및 사용량 통계 | ⚠️ | 모델 존재, UI 연동 중 |
| | 시스템 전체 공지 및 설정 | ❌ | 백엔드 관리 도구 예정 |
| **워크스페이스 설정**| 타겟 플랫폼 및 환경 URL | ✅ | UI 및 API 연동 완료 |
| | 모바일 앱 식별 정보 | ✅ | 패키지명/번들ID 등 메타데이터 연동 |
| | 카테고리 및 도메인 관리 | ✅ | 계층형 카테고리 및 담당자 지정 지원 |
| **Agent Control Center** | 미션 오케스트레이터 및 실시간 관제 사이드바 | ✅ | 의도 기반 플래닝 및 3대 의사결정 스트림 통합 완료 |
| **AI Agent Lab** | 대화형 탐색 루프 (WEB/APP) | ✅ | Gemini 2.0 기반 자율 주행 및 실시간 소통 지원 |
| **CI/CD Intelligence** | 실시간 배포 연계 및 자동 영향도 분석 | ✅ | 웹훅 기반 자율 테스트 선정 및 갭 분석 완료 |
| | Comm Link & Agentic Trace | ✅ | 40/60 분할 HUD 및 실시간 사고 과정 공유 |
| | 실시간 조향 및 긴급 중단 | ✅ | Instruction Bar 및 Stop Mission 기능 지원 |
| | Edit & Retry / Live View | ✅ | 스텝 직접 수정 및 1:1 실시간 화면 미러링 |
| | 실시간 자산화 (Save as Asset) | ✅ | 탐색 결과를 TestScript로 즉시 변환 |

---

