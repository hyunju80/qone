from app.db.session import SessionLocal
from app import crud, schemas
from app.models.user import User

def seed_skt_project():
    db = SessionLocal()
    try:
        # Get SKT Customer
        skt = crud.customer.get(db, id="cust_skt")
        if not skt:
            print("SKT Customer not found!")
            return

        # Check existing project
        projs = crud.project.get_multi_by_owner(db, owner_id=skt.id) # Assuming this method exists or similar
        # actually crud.project doesn't have get_multi_by_owner in default template usually, 
        # but let's try creating one if name doesn't exist
        
        # We can just create one directly
        project_in = schemas.ProjectCreate(
            name="SKT Default Workspace",
            description="Initial workspace for SKT",
            domain="skt.ai"
        )
        
        # Need user to be owner? Or customer?
        # In this system, projects belong to customer_account. 
        # User creates it.
        
        user = crud.user.get_by_email(db, email="admin@skt.ai")
        if user:
            # Check if exists
            exists = db.query(User).filter(User.email == "admin@skt.ai").first() # Just ensuring user
            
            # Create project manually (crud might expect more)
            # using crud.project.create_with_owner(db, obj_in=..., owner_id=user.id)
            try:
                # Mocking project check
                # Note: Default crud.create_with_owner assigns owner_id=user.id
                # and in our model Project.customer_account_id is key.
                # Use crud logic if available, or direct DB
                from app.models.project import Project
                p = db.query(Project).filter(Project.name == "SKT Default Workspace", Project.customer_account_id == skt.id).first()
                if not p:
                    p = Project(
                        id="proj_skt_1",
                        name="SKT Default Workspace",
                        description="Initial workspace",
                        domain="skt.ai",
                        customer_account_id=skt.id
                    )
                    db.add(p)
                    db.commit()
                    print("Created SKT Default Workspace")
                else:
                    print("SKT Workspace already exists")
            except Exception as e:
                print(f"Error creating project: {e}")

    finally:
        db.close()

if __name__ == "__main__":
    seed_skt_project()
