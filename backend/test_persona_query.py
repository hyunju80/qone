from app.db.session import SessionLocal
from app import crud

def test_query():
    db = SessionLocal()
    try:
        project_id = "proj_1769576747325" # Example from user log
        print(f"Testing fetch for project: {project_id}")
        results = crud.persona.get_multi_by_project(db, project_id=project_id)
        print(f"Found {len(results)} personas.")
        for p in results:
            print(f"- {p.name} (Project: {p.project_id})")
    except Exception as e:
        print(f"Error executing query: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_query()
