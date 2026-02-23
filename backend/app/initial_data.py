import logging
import uuid
import sys
from sqlalchemy.exc import IntegrityError
from app.db.session import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User, CustomerAccount
from app.models.project import Project
from app import crud, schemas

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_db(db: SessionLocal) -> None:
    # 1. Create Default Customer Account
    cust = db.query(CustomerAccount).filter(CustomerAccount.id == "cust_default").first()
    if not cust:
        try:
            cust = CustomerAccount(
                id="cust_default",
                company_name="Q-ONE Internal",
                business_number="000-00-00000",
                plan="Enterprise",
                billing_email="billing@qone.ai",
                admin_email="admin@qone.ai",
                 usage={
                    "aiTokens": {"current": 0, "max": 1000000},
                    "testRuns": {"current": 0, "max": 50000},
                    "scriptStorage": {"current": 0, "max": 2000},
                    "deviceHours": {"current": 0, "max": 10000}
                }
            )
            db.add(cust)
            db.commit()
            db.refresh(cust)
            logger.info("Created default customer account")
        except IntegrityError:
            db.rollback()
            cust = db.query(CustomerAccount).filter(CustomerAccount.id == "cust_default").first()
            logger.info("Default customer account already exists (rollback handled)")

    if not cust:
        logger.error("Failed to retrieve Default Customer.")
        return

    # 2. Create Super Admin User
    user = db.query(User).filter(User.email == "admin@qone.ai").first()
    if not user:
        try:
            user = User(
                id="user_admin",
                email="admin@qone.ai",
                password_hash=get_password_hash("password12"),
                name="Super Admin",
                role="Super Admin",
                is_saas_super_admin=True,
                customer_account_id=cust.id
            )
            db.add(user)
            db.commit()
            logger.info("Created super admin user (admin@qone.ai)")
        except IntegrityError:
            db.rollback()
            logger.info("Super admin user creation conflict")
    else:
        # Ensure role is correct
        if user.role != "Super Admin" or not user.is_saas_super_admin:
             user.role = "Super Admin"
             user.is_saas_super_admin = True
             db.add(user)
             db.commit()
             logger.info("Updated super admin role")

    # ------------------------------------------------------------------
    # 2. SKT Customer (Example for specific roles)
    # ------------------------------------------------------------------
    skt_customer = db.query(CustomerAccount).filter(CustomerAccount.id == "cust_skt").first()
    if not skt_customer:
        try:
            skt_customer = CustomerAccount(
                id="cust_skt",
                company_name="SKT",
                business_number="123-45-00002",
                plan="Enterprise",
                billing_email="billing@skt.ai",
                admin_email="admin@skt.ai",
                usage={
                    "aiTokens": {"current": 0, "max": 1000000},
                    "testRuns": {"current": 0, "max": 50000},
                    "scriptStorage": {"current": 0, "max": 2000},
                    "deviceHours": {"current": 0, "max": 10000}
                }
            )
            db.add(skt_customer)
            db.commit()
            db.refresh(skt_customer)
            logger.info("Created SKT customer")
        except IntegrityError:
            db.rollback()
            skt_customer = db.query(CustomerAccount).filter(CustomerAccount.id == "cust_skt").first()
            logger.info("SKT customer conflict handled")

    if not skt_customer:
        logger.error("Failed to retrieve SKT Customer.")
        return
    
    # 2.1 Customer Admin (admin@skt.ai)
    user = crud.user.get_by_email(db, email="admin@skt.ai")
    if not user:
        try:
            user = User(
                id=f"u_{uuid.uuid4().hex[:10]}",
                email="admin@skt.ai",
                password_hash=get_password_hash("password12"),
                name="SKT Admin",
                role="Admin",
                customer_account_id=skt_customer.id,
                is_saas_super_admin=False
            )
            db.add(user)
            db.commit()
            logger.info("Created SKT Admin")
        except IntegrityError:
             db.rollback()
             logger.info("SKT Admin conflict handled")
    else:
        if user.customer_account_id != skt_customer.id:
            user.customer_account_id = skt_customer.id
            db.add(user)
            db.commit()
            logger.info("Fixed SKT Admin customer link")
        if user.is_saas_super_admin:
            user.is_saas_super_admin = False
            db.add(user)
            db.commit()
            logger.info("Fixed SKT Admin flag (removed super admin)")

    # 2.4 Create Initial Project for SKT
    # Check if any project exists
    project = db.query(Project).filter(Project.customer_account_id == skt_customer.id).first()
    if not project:
        try:
            project = Project(
                id="proj_skt_initial",
                name="SKT Default Workspace",
                description="Main workspace for SKT",
                domain="skt.ai",
                customer_account_id=skt_customer.id,
                # created_at handle by default
                target_devices=[],
                environments={"Development": "http://dev.skt.ai", "Staging": "http://stg.skt.ai", "Production": "http://skt.ai"},
                object_repo=[]
            )
            db.add(project)
            db.commit()
            logger.info("Created SKT Default Workspace")
        except IntegrityError:
            db.rollback()
            logger.info("SKT Workspace conflict handled")
    else:
        logger.info(f"SKT Workspace already exists: {project.name}")

    logger.info("Initial data created/verified")

def main() -> None:
    logger.info("Creating initial data")
    db = SessionLocal()
    init_db(db)

if __name__ == "__main__":
    main()
