import uuid
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.db.base import Base # This imports all models
from app.models.user import PermissionMatrix

def seed_rbac():
    db: Session = SessionLocal()
    try:
        # Clear existing
        db.query(PermissionMatrix).delete()
        
        matrix = [
            # Workspace & IAM
            ("Workspace & IAM", "워크스페이스 생성/삭제", True, False, False, False),
            ("Workspace & IAM", "워크스페이스 설정 수정", True, True, False, False),
            ("Workspace & IAM", "사용자 초대 및 권한 관리", True, True, False, False),
            
            # Design Center
            ("Design Center", "시나리오/테스트 생성 (AI/Step)", True, True, True, False),
            ("Design Center", "테스트 자산 수정/삭제", True, True, True, False),
            ("Design Center", "자산 승인 (Certification)", True, True, False, False),
            ("Design Center", "오브젝트/데이터셋 등록/수정", True, True, True, False),
            
            # Execution
            ("Execution", "테스트 즉시 실행 (Manual/AI)", True, True, True, False),
            ("Execution", "스케줄 등록 및 수정", True, True, True, False),
            ("Execution", "스케줄 활성화/비활성화", True, True, True, False),
            
            # Intelligence
            ("Intelligence", "결과 리포트 및 로그 조회", True, True, True, True),
            ("Intelligence", "분석 리포트 삭제/관리", True, True, False, False),
            
            # Device Farm
            ("Device Farm", "디바이스 상태 모니터링", True, True, True, True),
            ("Device Farm", "실시간 로그 감사 및 제어", True, True, True, False),
        ]
        
        for cat, feature, admin, manager, qa, viewer in matrix:
            p = PermissionMatrix(
                id=str(uuid.uuid4()),
                category=cat,
                feature=feature,
                admin_allowed=admin,
                manager_allowed=manager,
                qa_engineer_allowed=qa,
                viewer_allowed=viewer
            )
            db.add(p)
        
        db.commit()
        print("RBAC Permission Matrix seeded successfully.")
    except Exception as e:
        print(f"Error seeding RBAC: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_rbac()
