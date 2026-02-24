from sqlalchemy import create_engine, text
import os

# Assuming SQLite for local dev based on usual patterns, but let's check env
DATABASE_URL = "sqlite:///./sql_app.db" # Default fallback

def check():
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        print("--- TestScript Table Content ---")
        result = conn.execute(text("SELECT id, name, project_id, run_count, success_rate FROM testscript"))
        for row in result:
            print(f"ID: {row[0]}, Name: {row[1]}, Project: {row[2]}, Runs: {row[3]}, Rate: {row[4]}%")

        print("\n--- StepAsset Table Content ---")
        result = conn.execute(text("SELECT id, name, project_id, run_count, success_rate FROM stepasset"))
        for row in result:
            print(f"ID: {row[0]}, Name: {row[1]}, Project: {row[2]}, Runs: {row[3]}, Rate: {row[4]}%")

if __name__ == "__main__":
    check()
