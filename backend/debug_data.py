from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app import crud, models

def verify_data():
    db = SessionLocal()
    try:
        print("--- Customers ---")
        customers = crud.customer.get_multi(db)
        cust_map = {}
        for c in customers:
            print(f"ID: {c.id}, Name: {c.company_name}")
            cust_map[c.id] = c.company_name
        
        print("\n--- Projects ---")
        projects = crud.project.get_multi(db)
        for p in projects:
            c_name = cust_map.get(p.customer_account_id, "UNKNOWN")
            print(f"ID: {p.id}, Name: {p.name}, CustomerID: {p.customer_account_id} ({c_name})")
            
    finally:
        db.close()

if __name__ == "__main__":
    verify_data()
