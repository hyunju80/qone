# Q-ONE 핵심 기능 명세 (Core Features)

이 문서는 Q-ONE 프로젝트의 주요 아키텍처 및 핵심 기능 명세를 정의합니다. AI 에이전트는 코드 작성 및 로직 수정 시 항상 이 문서를 최우선으로 참고하여 프로젝트 방향성을 유지해야 합니다.

---

## 1. AI Generator (시나리오 자동 생성)

AI Generator는 사용자의 요구사항이나 앱/웹 구조를 분석하여 **의도 기반(Intent-Based)** 테스트 시나리오를 자동 생성하는 핵심 모듈입니다. 구현 종속적인 스텝(예: "특정 버튼 클릭")이 아닌, High-Level의 비즈니스 목적(예: "관리자 인증 수행")을 중심으로 시나리오를 구성하여 자율 검증(Auto-Verification) 에이전트가 유연하게 동작할 수 있도록 합니다.

모든 시나리오는 생성 시 **자동으로 해당 도메인의 분과(Category)에 매핑**되며, 사용자는 생성된 **초안(Draft)을 직접 편집 및 수정**할 수 있습니다.

시나리오 생성은 다음 3가지 유형(모드)으로 설계 및 구동됩니다.

### 1.1. RAG DB 기반 (지식 기반/초기 세팅)
*   **목적**: 프로젝트 초기 QA 단계에서 도메인 지식(기획서, 화면설계서, 정책, 사용자 매뉴얼 등)을 바탕으로 테스트 케이스를 집중적으로 생성.
*   **핵심 동작 흐름**:
    1.  해당 프로젝트의 **분과(Category/Module)를 먼저 정의**합니다.
    2.  정의된 분과별로 RAG(Vector DB/RDBMS/NotebookLM 등)를 통해 관련된 주요 기능을 추출합니다.
    3.  추출된 주요 기능 단위로 상세한(의도 중심) 테스트 케이스를 생성합니다.
*   **필요 기술 전략**: 방대한 산출물을 청크 단위로 나누어 임베딩하고 검색할 수 있는 지식 베이스 아키텍처와 활용 전략.

### 1.2. Browsing 기반 (구조 파악 및 네비게이션)
*   **목적**: 실제 구동 중인 서비스의 계층 트리와 네비게이션 구조를 파악하고, 이에 대한 검증 시나리오를 생성. 주로 UI의 흐름(네비게이션 테스트)에 특화.
*   **핵심 동작 흐름**:
    1.  사용자(또는 프롬프트)가 지정한 타겟 URL, **탐색 깊이(Depth), 중점 목적(기능/의도)**을 기반으로 AI가 구조 파악을 시작합니다.
    2.  사전 탐색 결과를 바탕으로 화면 간의 **관계 맵(Map)**을 구축합니다.
    3.  구축된 맵을 바탕으로 사용자의 의도 입력 프롬프트를 받아(예: "결제 과정의 네비게이션 확인") 네비게이션 중심의 시나리오를 생성합니다.

### 1.3. Upload 기반 (추가/변경 기능 대응)
*   **목적**: 프로젝트 진행 중 새롭게 문서(이미지, 기획서 일부 수정 등)가 주어지거나 특정 기능이 변경되었을 때, 이를 분석하여 시나리오를 생성하고 기존 시나리오 갱신을 제안.
*   **핵심 동작 흐름**:
    1.  업로드된 문서(보통 이미지나 단건 텍스트 문서)를 파싱하여 변경된 테스트 의도를 파악합니다.
    2.  해당 내용을 바탕으로 **신규 테스트 시나리오 초안을 생성**합니다.
    3.  *(확장 기능)* 관련성 높은 기존 테스트 스크립트들을 조회하여, 이번 업데이트로 인해 **수정이 필요한 기존 케이스들을 선별하고 수정 방향을 제안**합니다.

---

### 파이프라인 연계도 (The Automation Pipeline)
AI Generator에서 방대하게 쏟아져 나오는 '의도 기반(Intent-Based)'의 시나리오들은 아래의 파이프라인을 거쳐 영구적인 자산으로 탈바꿈합니다.

1.  **시나리오 생성**: AI Generator (위 설명된 3개의 모드)
2.  **자가 검증 및 시나리오 상세화 (Auto-Verification)**: 자율 브라우징 에이전트(Oracle)가 '의도'를 건네받아 스스로 화면을 찾고 동작하며 검증을 수행. 이때 **실제로 수행한 세부 스텝(Action, Selector 중심)이 상세화**되어 기록됨.
3.  **자산화 (Assetization)**: 검증 과정을 성공적으로 마친 동작 기록들은 언제든 룰베이스(Rule-Based)로 무인 실행할 수 있는 `TestScript` 원천 코드로 변환됨.
4.  **데이터셋 맵핑 (DataSet Studio)**: 확정된 `TestScript`에 유효(Valid)/예외(Invalid)/보안(Security) 등 다양한 동적 데이터 셋을 결합하여, 하나의 스크립트로 수십 가지 케이스를 덮는 매트릭스 테스팅 환경 구축.

---

## 2. Step Flow (룰 기반 테스트 케이스 생성)

Step Flow는 AI의 자율 탐색 대신 사용자가 직접 브라우저나 앱의 동작 스텝을 정의하여 정밀한 테스트 시나리오를 구성하는 모듈입니다. 100% 사용자의 제어 하에 동작하며, 복잡한 비즈니스 로직이나 정확한 절차 검증이 필요한 경우에 최적화되어 있습니다.

### 2.1. Multi-Platform Inspector (라이브 인스펙터)
*   **실시간 요소 추출**: WEB(Playwright) 및 APP(Appium) 환경의 라이브 화면을 인스펙터를 통해 실시간으로 탐색하고, 클릭/입력 등의 세부 동작을 수행할 요소를 즉시 추출합니다.
*   **스텝 즉시 구성**: 인스펙터로 선택한 요소는 즉시 하나의 테스트 스텝(Action & Selector)으로 변환되어 시퀀스에 추가됩니다.

### 2.2. 직접 제어 기반의 신뢰성 (Precision & Control)
*   **No-AI 실행**: AI의 판단에 의존하지 않고 사용자가 정의한 룰(Rule)에 따라 실행되므로, 실행 결과의 일관성과 재현성이 매우 높습니다.
*   **복합 동작 설계**: 단순 클릭/입력 외에도 화면 대기, 조건부 점프, 텍스트 검증(Assertion) 등 정교한 테스트 로직을 구성할 수 있습니다.

### 2.3. 자산화 및 통합 관리 (Assetization)
*   **자산 라이브러리 연동**: 구성된 Step Flow 시나리오는 저장 시 즉시 `Test Asset`(Emerald Theme)으로 변환되어 Asset Library에 등록됩니다.
*   **범용 실행 엔진**: 생성된 자산은 AI로 생성된 자산과 동일하게 메인 콘솔에서 실행하거나 스케줄러에 등록하여 무인 자동화 테스트에 활용할 수 있습니다.

---

## 3. Asset Library (지능형 테스트 자산 관리)

Asset Library는 Q-ONE의 파이프라인(AI Generator, Step Flow 및 시나리오 상세화 과정)을 통해 생성된 모든 테스트 자산을 중앙에서 관리, 검토 및 최적화하는 핵심 Hub입니다. 단순한 리스트 표시를 넘어, 자산의 '지능(Intelligence)'을 직관적으로 제어할 수 있는 Unified Center 역할을 수행합니다.

### 3.1. Unified Intelligence Center (통합 지능 제어 센터)
모든 테스트 자산(AI 기반 자산 및 Step Flow 자산)은 단일화된 Intelligence Center를 통해 관리됩니다. 이를 통해 자산의 생성 배경부터 실행 세부 정보까지 한눈에 파악할 수 있습니다.
*   **Connected Scenario**: 해당 자산이 생성된 기반이 되는 비즈니스 시나리오 및 기획 의도를 실시간으로 조회하여 테스트의 타당성을 즉시 검토합니다.
*   **Step Intelligence**: 자북 에이전트가 탐색하며 생성한 세부 Step들을 직접 확인하고, 필요 시 Selector 및 Action을 정밀하게 튜닝할 수 있는 편집 환경을 제공합니다.
*   **Execution Context (Persona & Dataset)**:
    *   **Persona**: 테스트 수행 시 어떤 성향(초보 사용자, 전문가 등)으로 행동할지 정의된 가상 인격체를 관리합니다.
    *   **Dataset Studio**: 스크립트의 로직을 유지하면서도 다양한 변수(유효/예외 데이터)를 동적으로 치환하여 테스트 커버리지를 극대화합니다.

### 3.2. Dynamic Theming 기반의 자산 직관화
자산의 성격에 따라 시각적 테마를 동적으로 적용하여 사용자가 자산의 원천과 특성을 즉각적으로 인지할 수 있도록 합니다.
*   **Emerald Theme (Step Flow)**: 사용자가 직접 또는 Step Recorder를 통해 생성한 정형화된 절차 중심의 자산.
*   **Indigo Theme (AI Generated / Manual)**: AI의 자율 탐색을 통해 생성되었거나 실험적인 성격의 자산.

### 3.3. 자율 운영 정책 제어 (Autonomous Policy)
자산별로 서비스의 특성에 맞는 실행 전략을 개별적으로 설정하여 테스트의 신뢰도를 향상시킵니다.
*   **Self Healing Mode (셀프 힐링)**: UI 변경 등으로 인해 테스트 실패 시, AI 에이전트가 실시간으로 화면을 재분석하여 대체 경로를 찾거나 요소를 갱신하여 테스트를 완수하도록 하는 자율 복구 기능을 제어합니다.
*   **Retry Policy**: 일시적인 네트워크 지연이나 불안정한 환경에 대비하여 실패 시 최대 재시도 횟수를 정의합니다.

### 3.4. 전략적 필터링 및 관리 (Filter & Search)
대규모로 관리되는 테스트 자산을 빠르게 식별하기 위해 고도화된 필터링 체계를 제공합니다.
*   **Origin Filter**: AI 엔진 생성 자산과 Step Flow 자산을 분리하여 관리.
*   **Platform Context**: Web(Playwright) 및 App(Appium) 플랫폼별 자산 구분.
*   **Flexible Favorites**: 즐겨찾기 기능을 Origin/Platform 필터와 조합하여 개인화된 작업 뷰 구축 가능.

---

## 4. DataSet Studio (대용량 테스트 데이터 생성 및 관리)

DataSet Studio는 특정 테스트 자산(Test Asset)에 결합될 동적 데이터를 생성하고 관리하는 독립적인 데이터 엔지니어링 메뉴입니다. 자산이 생성된 방식(AI Generator, Step Flow 등)에 관계없이 모든 자산을 대상으로 매트릭스 테스팅을 위한 변수 셋을 구축할 수 있습니다.

### 4.1. 범용 데이터 엔진 (Universal Data Engine)
*   **자재/기법 종속성 제거**: AI Generator의 파이프라인 중 하나였던 단계를 독립 메뉴로 승격하여, 수동으로 만든 Step Flow 자산이나 외부에서 가져온 스크립트에도 즉시 대량의 데이터를 결합할 수 있습니다.
*   **분별력 있는 데이터 생성**: LLM을 활용하여 유효 데이터뿐만 아니라, 경계값(Edge Case), 보안 취약점 공격용 데이터(SQL Injection, XSS 등), 비정상 입력(Invalid) 등을 자동으로 생성합니다.

### 4.2. 자산-데이터 매핑 (Asset-Data Mapping)
*   **필드 자동 추출**: 선택한 자산의 코드를 분석하여 변수화 가능한 필드(예: `{{id}}`, `{{password}}`)를 자동으로 추출합니다.
*   **실행 시점 결합**: 생성된 데이터 셋은 스케줄러나 메인 콘솔에서 실행 시점에 스크립트 로직과 결합되어, 코드 수정 없이 수백 가지 케이스를 동시에 검증하게 합니다.

---

## 5. Design Center (중앙 설계 센터)

Design Center는 테스트 자동화에 필요한 모든 **메타데이터와 리소스(Persona, Object, Action, Global Data)**를 설계하고 관리하는 핵심 Hub입니다. 개별 프로젝트에 종속되거나 전역(Global)으로 공유되는 자산을 체계적으로 구축하여 AI 테스팅의 품질과 재사용성을 극대화합니다.

### 5.1. Persona Manager (지능형 가상 인격체 관리)
테스트를 수행할 AI 에이전트의 성격과 행동 양식을 정의합니다.
*   **Persona Identification**: 이름, 숙련도(Novice/Expert), 속도(Slow/Fast)를 설정하여 실제 사용자와 유사한 행동 패턴을 유도합니다.
*   **Behavioral Logic (AI Heuristics)**: 특정 비즈니스 상황에서 지켜야 할 "행동 강령"을 주입합니다. (예: "로그아웃 전 반드시 장바구니 리스트를 확인하라")
*   **Domain Filtering**: 프로젝트 도메인(Finance, Shopping 등)에 최적화된 페르소나를 우선 노출하여 테스트 맥락의 일관성을 유지합니다.
*   **Global Persona Scope**: 전사적으로 공유되는 '공용 페르소나'와 프로젝트 전용 페르소나를 구분하여 관리합니다.

### 5.2. Object Repository (오브젝트 저장소)
UI 구성 요소(Selector)를 자산화하여 관리합니다.
*   **Centralized Selector Management**: 화면의 요소들을 개별 스크립트에 하드코딩하지 않고, 중앙 저장소에서 이름(ID) 기반으로 관리하여 UI 변경 시 유지보수 비용을 최소화합니다.
*   **Platform Specificity**: Web(ID, CSS, XPath) 및 Mobile App(Accessibility ID, Resource ID) 플랫폼별 최적화된 선택자를 지원합니다.
*   **Visual Card View**: 등록된 오브젝트들을 카드 형태로 직관적으로 확인하고 필터링할 수 있는 UI를 제공합니다.

### 5.3. Action Library (재사용 가능한 액션 꾸러미)
반복되는 동작 시퀀스를 함수화(Action)하여 조립 가능한 형태로 관리합니다.
*   **Modular Action Design**: '로그인', '주문 결제'와 같이 빈번하게 일어나는 동작들을 모듈화하여 새로운 시나리오 작성 시 간단한 선택만으로 스텝을 구성합니다.
*   **Object Linking**: 각 액션이 어떤 오브젝트를 대상으로 동작하는지 연계 정보를 관리하여 데이터 흐름을 명확히 합니다.

### 5.4. Global Data (중앙 공유 데이터 세트)
여러 시나리오에서 공동으로 사용하는 기초 데이터를 관리합니다.
*   **Schema-based Table Structure**: 사용자가 직접 컬럼(Key)을 정의하고 여러 행(Record)의 데이터를 입력할 수 있는 유연한 테이블 구조를 제공합니다.
*   **Context-Aware Data**: 유효(Valid), 비유효(Invalid), 보안(Security) 등 테스트 의도에 맞춘 데이터셋을 미리 구축하여 필요할 때 즉시 가져다 쓸 수 있습니다.
*   **Clear Initialization**: 새 데이터셋 생성 시 이전 상태가 남지 않도록 완벽하게 초기화된 작업 환경을 제공하여 데이터 무결성을 보장합니다.

---

## 6. Smart Scheduler (지능형 테스트 오케스트레이션)

Smart Scheduler는 정기적인 배치 실행부터 배포 연계형 실행까지, 테스트 자산의 자율적 운영 환경을 정의하는 핵심 오케스트레이션 엔진입니다. 단순한 반복 실행을 넘어 장애 상황에 대한 지능적인 전파 정책을 수립합니다.

### 6.1. Autonomous Trigger Strategy (자율 실행 전략)
*   **Scheduled**: 표준 크론(Cron) 표현식 및 프리셋을 통해 일간/주간/월간 단위의 정기적인 회귀 테스트를 수행합니다.
*   **Post-Deployment**: CI/CD 파이프라인의 Webhook과 연동되어, 새로운 코드가 배포된 직후 검증 테스트를 즉시 트리거합니다.

### 6.2. Priority-Based Preemption (우선순위 및 자원 선점)
작업의 중요도에 따라 실행 우선순위를 고도화하여 최적의 리소스 분배를 실현합니다.
*   **Critical Tier**: 고위험/핵심 비즈니스 로직을 대상으로 하며, 리소스 부족 시 낮은 우선순위의 작업을 중단하거나 큐의 맨 앞으로 이동시키는 **실전 선점(Execution Preemption)** 로직을 적용합니다.
*   **High / Normal Tier**: 일반적인 품질 관리 및 루틴 테스트를 위해 순차적으로 리소스를 할당받습니다.

### 6.3. Incident Orchestration Policy (장애 대응 정책)
테스트 실패 시 단순 로그 기록을 넘어 실시간 장애 전파와 대응 체계를 구축합니다.
*   **Alert Configuration**: Slack, Email, Jira 등 다양한 채널을 통해 장애 상황을 실시간으로 디스패치합니다.
*   **Failure Threshold (임계치)**: 네트워크 지연 등 일시적 오류를 걸러내기 위해 연속 실패 횟수에 따른 알림 발생 시점을 정밀하게 제어합니다.
*   **Policy Strictness**: `Critical Failures Only` 모드를 통해 시스템 중단과 같은 치명적 오류 상황에서만 알림을 집중하여 알림 피로도를 관리합니다.

### 6.4. Integrated Asset Control (통합 자산 제어)
*   **Test Asset Selection**: 자산 라이브러리(`Asset Library`)와 직접 연계되어 여러 시나리오를 하나의 배치 작업으로 묶어 통합 관리합니다.
*   **Search & Filtering**: 수백 개의 배치 작업 중 트리거 유형(Schedule/Deployment) 및 자산 명칭 기반의 고도화된 필터링으로 스케줄 가시성을 확보합니다.

---

## 7. Device Farm (디바이스 인프라 관리)

Device Farm은 테스트가 수행되는 실제 하드웨어 자원을 실시간으로 모니터링하고 제어하는 통합 인프라 관리 센터입니다. 분산된 디바이스 노드(Node)들의 상태를 한눈에 파악하고, 원격에서 하드웨어 레벨의 감사 및 제어를 수행합니다.

### 7.1. Real-time Infrastructure Monitoring (실시간 모니터링)
*   **Hardware Health HUD**: 개별 디바이스의 CPU 모델, RAM 용량, 해상도 및 OS 버전을 실시간으로 시각화합니다.
*   **Status Tracking**: 디바이스의 가용 상태(`Available`, `In-Use`, `Offline`)를 추적하며, 특히 `In-Use` 상태일 경우 현재 어떤 프로젝트의 테스트가 수행 중인지 프로젝트 명칭을 즉시 노출합니다.
*   **Connectivity Metrics**: 네트워크 지연 시간(Latency) 및 패킷 손실률(Packet Loss)을 모니터링하여 테스트 환경의 품질을 보장합니다.

### 7.2. Autonomous Terminal Audit (자율 터미널 감사)
*   **Live Log Streaming**: ADB(Android) 및 각 플랫폼 프로토콜을 백엔드와 WebSocket으로 직결하여, 라이브 로그 스트림을 브라우저에서 즉시 확인할 수 있습니다.
*   **Telemetry Analysis**: 서비스 로그뿐만 아니라 시스템(OS) 레벨의 이벤트를 수집하여, 테스트 실패 시 하드웨어적 결함이나 시스템 리소스 부족 여부를 정밀 분석합니다.

### 7.3. Hardware Lifecycle Control (하드웨어 제어)
*   **Remote Node Management**: 디바이스 노드에 대한 강제 연결 해제(Force Disconnect) 및 재연결(Reconnect) 기능을 제공하여, 물리적 접근 없이도 인프라 이상 기동 시 원격 복구를 수행합니다.
*   **Multi-Platform Orchestration**: Android(AOS), iOS, Windows, macOS 등 다양한 운영체제를 단일 인터페이스에서 통합 관리하며, UDID 기반의 고유 식별 체계를 유지합니다.

---

## 8. Admin & User Management (관리자 및 사용자 관리)

Q-ONE은 기업 단위의 계층 구조와 세분화된 권한 체계를 통해 대규모 테스트 인프라를 안정적으로 운영할 수 있는 관리 환경을 제공합니다.

### 8.1. Hierarchical Organization (Q-ONE 계층 구조)
*   **Company (Customer Account)**: 최상위 관리 단위로, 기업별 독립된 데이터 공간과 라이선스/플랜(`Free`, `Pro`, `Enterprise`)을 관리합니다.
*   **Workspace (Project)**: 실제 테스트가 수행되는 작업 단위입니다. 하나의 Company는 여러 개의 Workspace를 가질 수 있으며, 각 Workspace는 독립적인 테스트 자격 증명, 디바이스 구성 및 시나리오를 가집니다.

### 8.2. Multi-Tiered Authorization (사용자 권한 체계)
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

### 8.3. User Lifecycle Management (사용자 관리 및 보안)
*   **Secure Authentication**: 이메일 기반의 ID/PW 인증 체계를 제공하며, JWT(JSON Web Token)를 통한 보안 세션 관리를 수행합니다.
*   **Workspace Invitation**: 이메일 초대를 통해 새로운 사용자를 특정 워크스페이스에 즉시 참여시키고 역할을 부여할 수 있습니다.
*   **Self-Service Profile**: 사용자는 자신의 프로필 정보를 관리하고 비밀번호를 직접 수정하여 보안 수준을 유지할 수 있습니다.

---

## 9. Workspace Configuration (워크스페이스 설정 및 관리)

워크스페이스는 테스트가 수행되는 가장 핵심적인 논리적 단위이며, 각 워크스페이스는 독립적인 인프라, 앱 식별 정보 및 조직 체계를 가집니다.

### 9.1. Application Identity & Infrastructure (애플리케이션 식별 및 인프라)
플랫폼 타겟팅부터 실행 환경까지, 테스트 가동을 위한 기술적 기반을 통합 관리하는 블록입니다.

*   **Target Technology Stacks (대상 플랫폼)**: 테스트 에이전트가 구동될 타겟(PC-Web, Mobile-Web, Mobile-App)을 정의하고 활성화합니다.
*   **Platform Identification Metadata (Appium 식별 정보)**: `Mobile-App` 활성화 시, Oracle 에이전트가 글로벌 디바이스 팜에서 타겟 앱을 식별하고 자동 실행하는 데 필요한 `Package Name` (Android), `Bundle Identifier` (iOS) 및 **Version Policy**(특정 빌드 지정을 위한 버전 정책) 등의 핵심 메타데이터를 관리합니다.
*   **Environment Infrastructure (환경별 접속 정보)**: `Development`, `Staging`, `Production` 등 서비스 생애주기별 서버 URL을 매핑합니다. 테스트 실행 시 환경을 선택하면 시나리오 수정 없이 해당 타겟 서버로 자동 라우팅되는 동적 접속 환경을 제공합니다.

### 9.2. Project Taxonomy & Organization (프로젝트 계층 및 조직화)
수천 개의 테스트 자산을 비즈니스 로직에 따라 체계적으로 분류하고 관리 책임을 정의하는 블록입니다.

*   **Module Categories (계층형 카테고리)**: 업무 단위별 부모-자식(Parent-Child) 관계를 가지는 카테고리를 정의하여 테스트 자산의 가시성을 확보합니다.
*   **Domain Responsibility Mapping**: 각 카테고리별로 담당 관리자(Manager)를 지정하여, 해당 도메인의 테스트 품질 관리 및 자산 승인에 대한 책임 소재를 명확히 합니다.

---

## 10. Implementation Status (구현 현황 요약)

| 구분 | 주요 기능 | 구현 상태 | 비고 |
| :--- | :--- | :---: | :--- |
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
