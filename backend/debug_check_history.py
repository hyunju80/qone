from sqlalchemy import create_engine, text

# Hardcode for debug
SQLALCHEMY_DATABASE_URI = "postgresql://postgres:password@localhost:5432/qone"

try:
    engine = create_engine(SQLALCHEMY_DATABASE_URI)
    with engine.connect() as connection:
        # Join testhistory and testscript to verify Project ID
        query = """
        SELECT h.id, h.script_id, s.name as script_name, s.project_id, h.run_date 
        FROM testhistory h
        LEFT JOIN testscript s ON h.script_id = s.id
        ORDER BY h.run_date DESC 
        LIMIT 10
        """
        result = connection.execute(text(query))
        rows = result.fetchall()
        print(f"Total Joined History Records (Limit 10): {len(rows)}")
        for row in rows:
            print(f"HistoryID: {row[0]}, ScriptID: {row[1]}, ScriptName: {row[2]}, ProjectID: {row[3]}")
except Exception as e:
    print(f"Error: {e}")
