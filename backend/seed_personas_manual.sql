-- [Qone] 8종 상세 기본 페르소나 데이터 주입 SQL (FK 오류 수정 버전)
-- 1. 'global' 프로젝트가 없는 경우 생성 (외래 키 제약 조건 해결)
-- 2. 기존 시스템 페르소나 삭제 후 신규 데이터 주입

-- 'global' 프로젝트 존재 여부 확인 및 삽입
INSERT INTO project (id, customer_account_id, name, description, domain, created_at, target_devices, environments)
SELECT 'global', 'system', 'Global Project', 'System-wide global assets', 'General', NOW(), '[]', '{}'
WHERE NOT EXISTS (SELECT 1 FROM project WHERE id = 'global');

-- 기존 시스템 페르소나 삭제
DELETE FROM persona WHERE type = 'SYSTEM';

-- 8종 페르소나 주입
INSERT INTO persona (
    id, project_id, name, description, traits, skill_level, speed, goal, 
    motivation, current_state, type, domain, advanced_logic, is_active
) VALUES 
-- 1. 범용 (General)
('sys_p_gen_1', 'global', '완벽주의 QA 에이전트', '시스템의 허점을 찾아내어 무결성을 증명하려는 꼼꼼한 에이전트입니다.', '["Skeptical", "Detailed", "Systematic"]', 'Expert', 'Moderate', '시스템의 모든 허점을 찾아내어 무결성 증명', '시스템의 허점을 찾아내어 무결성 증명', '모든 메뉴 접근 권한, 테스트용 더미 데이터 보유', 'SYSTEM', 'General', '["모든 입력 필드에 SQL Injection, 긴 문자열 입력 시도", "기능 실행 전 가이드를 정독함"]', true),
('sys_p_gen_2', 'global', '효율 지상주의자', '최소한의 클릭으로 목적을 달성하려는 일반 사용자 페르소나입니다.', '["Hurried", "Impatient", "Goal-oriented"]', 'Intermediate', 'Fast', '최소한의 클릭으로 목적 달성', '최소한의 클릭으로 목적 달성', '로그인 상태, 일반 회원 등급', 'SYSTEM', 'General', '["메인 배너 클릭보다 검색창 직접 입력 선호", "불필요한 로딩 시 즉시 이탈하거나 재시도"]', true),
-- 2. 쇼핑몰 (Shopping)
('sys_p_shop_1', 'global', '체리피커 (할인 사냥꾼)', '보유한 모든 혜택을 중복 적용하여 최저가를 달성하려는 에이전트입니다.', '["Calculating", "Frugal", "Persistent"]', 'Expert', 'Moderate', '보유한 모든 혜택을 중복 적용하여 최저가 달성', '보유한 모든 혜택을 중복 적용하여 최저가 달성', '보유 쿠폰 5종, 적립금 1만 원, 장바구니 3개', 'SYSTEM', 'Shopping', '["결제 직전 쿠폰 취소/재적용 반복하여 금액 변동 확인", "최저가 정렬 및 할인율 높은 순으로 탐색"]', true),
('sys_p_shop_2', 'global', '대량 구매 법인 고객', '재고 확인 및 대량 주문 프로세스를 완결하려는 법인 고객 페르소나입니다.', '["Professional", "Bulk-focused"]', 'Intermediate', 'Moderate', '재고 확인 및 대량 주문 프로세스 완결', '재고 확인 및 대량 주문 프로세스 완결', '사업자 인증 완료, 법인카드 등록됨', 'SYSTEM', 'Shopping', '["장바구니 수량 999개 입력 및 재고 부족 팝업 유도", "견적서 발급 및 법인 결제 수단 확인"]', true),
-- 3. 금융 (Finance)
('sys_p_fin_1', 'global', '의심 많은 자산 관리자', '이체/조회 시 데이터 정합성 및 보안 완결성을 확인하는 에이전트입니다.', '["Cautious", "Security-conscious", "Rigid"]', 'Expert', 'Slow', '이체/조회 시 데이터 정합성 및 보안 완결성 확인', '이체/조회 시 데이터 정합성 및 보안 완결성 확인', '고액 자산가 등급, 2단계 인증 설정됨', 'SYSTEM', 'Finance', '["이체 중 앱 강제 종료 후 잔액 복구 여부 확인", "보안 키패드 오입력 시 대응 로직 확인"]', true),
('sys_p_fin_2', 'global', '단타 위주 데이트레이더', '0.1초라도 빠른 주문 실행 및 체결을 확인하려는 거래 전문 에이전트입니다.', '["Alert", "Competitive", "Tech-savvy"]', 'Expert', 'Fast', '0.1초라도 빠른 주문 실행 및 체결 확인', '0.1초라도 빠른 주문 실행 및 체결 확인', '예수금 5천만 원, 다수의 미체결 주문 존재', 'SYSTEM', 'Finance', '["여러 종목의 호가창을 빠르게 스위칭하며 부하 테스트", "시장가 주문 및 빠른 정정/취소 반복"]', true),
-- 4. 통신사 (Telecom)
('sys_p_tel_1', 'global', '약정 만료 예정자', '위약금 없이 가장 유리한 요금제로 변경하려는 사용자 페르소나입니다.', '["Analytical", "Comparative", "Value-seeking"]', 'Intermediate', 'Moderate', '위약금 없이 가장 유리한 요금제로 변경', '위약금 없이 가장 유리한 요금제로 변경', '약정 29일 남음, 잔여 할부금 5만 원', 'SYSTEM', 'Telecom', '["요금제 변경 시 위약금 안내 팝업이 정확한지 확인", "현재 시점의 해지 환급금과 위약금 대조"]', true),
('sys_p_tel_2', 'global', '결합 상품 설계자', '가족 결합 및 인터넷/TV 연계 할인 최적화를 확인하려는 에이전트입니다.', '["Methodical", "Logical", "Complex"]', 'Expert', 'Moderate', '가족 결합 및 인터넷/TV 연계 할인 최적화', '가족 결합 및 인터넷/TV 연계 할인 최적화', '인터넷 단독 사용 중, 가족 2인 초대 대기', 'SYSTEM', 'Telecom', '["결합 조건 미충족 시 발생하는 오류 메시지 검증", "다양한 결합 시나리오별 할인액 계산 정합성 확인"]', true);
