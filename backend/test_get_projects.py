from app.db.session import SessionLocal
import app.models
from app.schemas.project import ProjectUpdate
from app.crud.crud_project import project as crud_project

db = SessionLocal()
try:
    proj = db.query(app.models.Project).first()
    if proj:
        print('Before Update DB CATEGORIES:', proj.categories)
        
        # Simulate UI sending an update
        update_data = {"categories": [{"id": "cat_custom123", "name": "Custom Category"}]}
        proj_in = ProjectUpdate(**update_data)
        
        # print what model_dump does
        print('Update model_dump:', proj_in.model_dump(exclude_unset=True))
        
        updated = crud_project.update(db, db_obj=proj, obj_in=proj_in)
        print('After Update DB CATEGORIES:', updated.categories)
        
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
