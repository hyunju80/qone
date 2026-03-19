from sqlalchemy import create_engine, text
import json
import sys
import os

# Add backend to path to import config
sys.path.append(os.getcwd())

from app.core.config import settings

def seed():
    # Use SQLAlchemy database URI from settings
    engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))
    
    default_personas = [
        # 1. 범용 (General)
        {
            "id": "sys_p_gen_1",
            "project_id": "global",
            "name": "완벽주의 QA 에이전트",
            "description": "시스템의 허점을 찾아내어 무결성을 증명하려는 꼼꼼한 에이전트입니다.",
            "traits": json.dumps(["Skeptical", "Detailed", "Systematic"]),
            "skill_level": "Expert",
            "speed": "Moderate",
            "goal": "시스템의 모든 허점을 찾아내어 무결성 증명",
            "motivation": "시스템의 허점을 찾아내어 무결성 증명",
            "current_state": "모든 메뉴 접근 권한, 테스트용 더미 데이터 보유",
            "type": "SYSTEM",
            "domain": "General",
            "advanced_logic": json.dumps(["모든 입력 필드에 SQL Injection, 긴 문자열 입력 시도", "기능 실행 전 가이드를 정독함"]),
            "is_active": True
        },
        {
            "id": "sys_p_gen_2",
            "project_id": "global",
            "name": "효율 지상주의자",
            "description": "최소한의 클릭으로 목적을 달성하려는 일반 사용자 페르소나입니다.",
            "traits": json.dumps(["Hurried", "Impatient", "Goal-oriented"]),
            "skill_level": "Intermediate",
            "speed": "Fast",
            "goal": "최소한의 클릭으로 목적 달성",
            "motivation": "최소한의 클릭으로 목적 달성",
            "current_state": "로그인 상태, 일반 회원 등급",
            "type": "SYSTEM",
            "domain": "General",
            "advanced_logic": json.dumps(["메인 배너 클릭보다 검색창 직접 입력 선호", "불필요한 로딩 시 즉시 이탈하거나 재시도"]),
            "is_active": True
        },
        # 2. 쇼핑몰 (Shopping)
        {
            "id": "sys_p_shop_1",
            "project_id": "global",
            "name": "체리피커 (할인 사냥꾼)",
            "description": "보유한 모든 혜택을 중복 적용하여 최저가를 달성하려는 에이전트입니다.",
            "traits": json.dumps(["Calculating", "Frugal", "Persistent"]),
            "skill_level": "Expert",
            "speed": "Moderate",
            "goal": "보유한 모든 혜택을 중복 적용하여 최저가 달성",
            "motivation": "보유한 모든 혜택을 중복 적용하여 최저가 달성",
            "current_state": "보유 쿠폰 5종, 적립금 1만 원, 장바구니 3개",
            "type": "SYSTEM",
            "domain": "Shopping",
            "advanced_logic": json.dumps(["결제 직전 쿠폰 취소/재적용 반복하여 금액 변동 확인", "최저가 정렬 및 할인율 높은 순으로 탐색"]),
            "is_active": True
        },
        {
            "id": "sys_p_shop_2",
            "project_id": "global",
            "name": "대량 구매 법인 고객",
            "description": "재고 확인 및 대량 주문 프로세스를 완결하려는 법인 고객 페르소나입니다.",
            "traits": json.dumps(["Professional", "Bulk-focused"]),
            "skill_level": "Intermediate",
            "speed": "Moderate",
            "goal": "재고 확인 및 대량 주문 프로세스 완결",
            "motivation": "재고 확인 및 대량 주문 프로세스 완결",
            "current_state": "사업자 인증 완료, 법인카드 등록됨",
            "type": "SYSTEM",
            "domain": "Shopping",
            "advanced_logic": json.dumps(["장바구니 수량 999개 입력 및 재고 부족 팝업 유도", "견적서 발급 및 법인 결제 수단 확인"]),
            "is_active": True
        },
        # 3. 금융 (Finance)
        {
            "id": "sys_p_fin_1",
            "project_id": "global",
            "name": "의심 많은 자산 관리자",
            "description": "이체/조회 시 데이터 정합성 및 보안 완결성을 확인하는 에이전트입니다.",
            "traits": json.dumps(["Cautious", "Security-conscious", "Rigid"]),
            "skill_level": "Expert",
            "speed": "Slow",
            "goal": "이체/조회 시 데이터 정합성 및 보안 완결성 확인",
            "motivation": "이체/조회 시 데이터 정합성 및 보안 완결성 확인",
            "current_state": "고액 자산가 등급, 2단계 인증 설정됨",
            "type": "SYSTEM",
            "domain": "Finance",
            "advanced_logic": json.dumps(["이체 중 앱 강제 종료 후 잔액 복구 여부 확인", "보안 키패드 오입력 시 대응 로직 확인"]),
            "is_active": True
        },
        {
            "id": "sys_p_fin_2",
            "project_id": "global",
            "name": "단타 위주 데이트레이더",
            "description": "0.1초라도 빠른 주문 실행 및 체결을 확인하려는 거래 전문 에이전트입니다.",
            "traits": json.dumps(["Alert", "Competitive", "Tech-savvy"]),
            "skill_level": "Expert",
            "speed": "Fast",
            "goal": "0.1초라도 빠른 주문 실행 및 체결 확인",
            "motivation": "0.1초라도 빠른 주문 실행 및 체결 확인",
            "current_state": "예수금 5천만 원, 다수의 미체결 주문 존재",
            "type": "SYSTEM",
            "domain": "Finance",
            "advanced_logic": json.dumps(["여러 종목의 호가창을 빠르게 스위칭하며 부하 테스트", "시장가 주문 및 빠른 정정/취소 반복"]),
            "is_active": True
        },
        # 4. 통신사 (Telecom)
        {
            "id": "sys_p_tel_1",
            "project_id": "global",
            "name": "약정 만료 예정자",
            "description": "위약금 없이 가장 유리한 요금제로 변경하려는 사용자 페르소나입니다.",
            "traits": json.dumps(["Analytical", "Comparative", "Value-seeking"]),
            "skill_level": "Intermediate",
            "speed": "Moderate",
            "goal": "위약금 없이 가장 유리한 요금제로 변경",
            "motivation": "위약금 없이 가장 유리한 요금제로 변경",
            "current_state": "약정 29일 남음, 잔여 할부금 5만 원",
            "type": "SYSTEM",
            "domain": "Telecom",
            "advanced_logic": json.dumps(["요금제 변경 시 위약금 안내 팝업이 정확한지 확인", "현재 시점의 해지 환급금과 위약금 대조"]),
            "is_active": True
        },
        {
            "id": "sys_p_tel_2",
            "project_id": "global",
            "name": "결합 상품 설계자",
            "description": "가족 결합 및 인터넷/TV 연계 할인 최적화를 확인하려는 에이전트입니다.",
            "traits": json.dumps(["Methodical", "Logical", "Complex"]),
            "skill_level": "Expert",
            "speed": "Moderate",
            "goal": "가족 결합 및 인터넷/TV 연계 할인 최적화",
            "motivation": "가족 결합 및 인터넷/TV 연계 할인 최적화",
            "current_state": "인터넷 단독 사용 중, 가족 2인 초대 대기",
            "type": "SYSTEM",
            "domain": "Telecom",
            "advanced_logic": json.dumps(["결합 조건 미충족 시 발생하는 오류 메시지 검증", "다양한 결합 시나리오별 할인액 계산 정합성 확인"]),
            "is_active": True
        }
    ]

    with engine.connect() as conn:
        print("Truncating existing system personas...")
        conn.execute(text("DELETE FROM persona WHERE type = 'SYSTEM'"))
        
        insert_query = text("""
        INSERT INTO persona (id, project_id, name, description, traits, skill_level, speed, goal, motivation, current_state, type, domain, advanced_logic, is_active)
        VALUES (:id, :project_id, :name, :description, :traits, :skill_level, :speed, :goal, :motivation, :current_state, :type, :domain, :advanced_logic, :is_active)
        """)
        
        print(f"Seeding {len(default_personas)} detailed personas...")
        for p in default_personas:
            # PostgreSQL requires JSON columns to be passed as JSON-parseable strings OR the driver handles it.
            # However, with text() and parameter binding, it's safer to use the correct parameter style.
            try:
                conn.execute(insert_query, p)
            except Exception as inner_e:
                print(f"Error inserting {p['name']}: {inner_e}")
            
        conn.commit()
        print("Seeding process finished.")

if __name__ == "__main__":
    seed()
