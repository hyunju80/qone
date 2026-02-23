import os
import sys
import uuid

# Add backend directory to sys.path
sys.path.append(os.getcwd())

from app.db.session import SessionLocal
from app.models.test import Persona

def seed_personas():
    db = SessionLocal()
    try:
        # Check if p1 exists
        p1 = db.query(Persona).filter(Persona.id == "p1").first()
        if not p1:
            print("Seeding Persona p1...")
            # Mock data from frontend (simplified)
            p1 = Persona(
                id="p1",
                name="QA Expert",
                description="Strict and detailed QA engineer",
                goal="Ensure zero bugs in critical flows",
                skill_level="Expert",
                speed="Fast"
            )
            db.add(p1)
            db.commit()
            print("Persona p1 seeded.")
        else:
            print("Persona p1 already exists.")
            
    except Exception as e:
        print(f"Error seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_personas()
