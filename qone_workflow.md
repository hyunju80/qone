# Q-ONE 사용자 워크플로우 (User Workflow)

Q-ONE 플랫폼에서의 테스트 자동화 프로세스는 **자산화(Assetization) → 설계(Design) → 실행(Execution) → 분석(Analysis)**의 4단계 순환 구조를 따릅니다.

## 1. 전체 프로세스 다이어그램

```mermaid
graph LR
    subgraph "1. 자산 관리 (Design Center)"
        Object[오브젝트 등록<br>(Object Repository)]
        Action[액션 정의<br>(Action Library)]
        Data[데이터 구성<br>(Test Data)]
    end

    subgraph "2. 테스트 설계 (Test Design)"
        Scenario[시나리오 생성]
        Assembly[블록 조립<br>(Step Runner)]
    end

    subgraph "3. 테스트 실행 (Execution)"
        Local[로컬 디버깅<br>(Headful)]
        CI[CI/CD 실행<br>(Headless)]
    end

    subgraph "4. 결과 분석 (Reporting)"
        Report[결과 리포트]
        Jira[Jira 이슈 생성]
    end

    Object --> Assembly
    Action --> Assembly
    Data --> Assembly
    
    Scenario --> Assembly
    Assembly --> Local
    Assembly --> CI
    
    Local --> Report
    CI --> Report
    Report -.-> Jira
    Report -.-> Object
```

---

## 2. 상세 단계별 워크플로우

### 1단계: 자산 관리 (Asset Management) - *Design Center*
테스트에 필요한 재료를 준비하는 단계입니다. 유지보수성을 높이기 위해 모든 요소는 '자산(Asset)'으로 관리됩니다.

1.  **Object Repository (화면 요소 정의)**
    *   웹/앱의 버튼, 입력창 등을 스파이(Spy) 도구로 캡처하여 등록합니다.
    *   AI가 자동으로 최적의 선택자(Selector)를 추천합니다.
2.  **Action Library (동작 정의)**
    *   "로그인", "상품 검색", "결제"와 같은 공통 동작을 모듈화합니다.
    *   Python/Playwright 코드로 구현되며, 재사용 가능합니다.
3.  **Data Management (데이터 정의)**
    *   테스트에 사용할 입력값(ID, PW 등)을 환경별(Dev/Stg/Prod) 또는 케이스별(성공/실패)로 정의합니다.

### 2단계: 테스트 설계 (Test Design) - *Step Runner & Generator*
준비된 자산을 조립하여 실제 테스트 시나리오를 만듭니다.

1.  **AI Scenario Generator**
    *   "로그인 후 마이페이지로 이동하는 테스트 만들어줘"라고 입력하면 AI가 초안을 생성합니다.
2.  **Block Assembly (블록 조립)**
    *   생성된 초안을 **Step Runner** 화면에서 블록 형태로 수정/보완합니다.
    *   드래그 앤 드롭으로 액션 순서를 변경하거나 데이터를 매핑합니다.

### 3단계: 테스트 실행 (Test Execution)
작성된 테스트를 다양한 환경에서 실행합니다.

1.  **Local Debugging (로컬 실행)**
    *   테스트 작성자가 내 PC에서 브라우저를 띄워(Headful) 즉시 실행해봅니다.
    *   단계별 실행(Step-by-Step)을 통해 로직을 검증합니다.
2.  **CI/CD Pipeline (원격 실행)**
    *   GitLab/Jenkins 등과 연동되어 배포 시점에 자동으로 실행됩니다(Headless).
    *   수백 개의 테스트가 병렬로 수행됩니다.

### 4단계: 결과 분석 및 피드백 (Reporting & Feedback)
실행 결과를 확인하고 조치합니다.

1.  **Test Report**
    *   성공/실패 여부를 대시보드에서 확인합니다.
    *   실패 시 스크린샷, 동영상, 로그를 통해 원인을 분석합니다.
2.  **Defect Management**
    *   버그 발견 시 Jira 티켓을 자동으로 생성합니다.
3.  **Self-Healing (피드백)**
    *   화면 변경으로 인한 실패 시, AI가 변경된 요소를 감지하고 Object Repository를 업데이트합니다.

---

## 3. 사용자별 역할 (R&R)

| 역할 | 주요 활동 | 주요 사용 메뉴 |
| :--- | :--- | :--- |
| **QA 엔지니어 (SDET)** | 공통 액션 개발, CI/CD 연동, 복잡한 로직 구현 | Action Library, Settings |
| **테스트 설계자** | 시나리오 구상, 테스트 데이터 정의, 블록 조립 | Design Center, Step Runner |
| **현업 담당자 (PO/PM)** | 자연어로 요구사항 입력, 결과 리포트 확인 | Test Generator, Dashboard |
