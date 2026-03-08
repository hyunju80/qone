from app.db.session import SessionLocal
import app.models # imports all models to fix dependent classes error
from app.schemas.project import ProjectUpdate
from app.crud.crud_project import project as crud_project
from sqlalchemy.orm.attributes import flag_modified

db = SessionLocal()
try:
    proj = db.query(app.models.Project).first()
    if proj:
        print('Before Update DB CATEGORIES:', proj.categories)
        
        # Simulate UI sending an update
        update_data = {"categories": [{"id": "cat_flag_test", "name": "Flagged Category"}]}
        proj_in = ProjectUpdate(**update_data)
        
        # Manually updating
        update_dict = proj_in.model_dump(exclude_unset=True)
        for field in update_dict:
            setattr(proj, field, update_dict[field])
            
        print('categories assigned:', proj.categories)
        
        # THIS IS THE FIX WE ARE TESTING
        flag_modified(proj, 'categories')
        
        db.add(proj)
        db.commit()
        db.refresh(proj)
        
        print('After Update DB CATEGORIES:', proj.categories)
        
        # Verify in fresh session
        db.close()
        db = SessionLocal()
        proj_refresh = db.query(app.models.Project).first()
        print('Fresh Fetch DB CATEGORIES:', proj_refresh.categories)
    else:
        print('No project found')
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    db.close()
