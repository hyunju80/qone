import psycopg2
from app.core.config import settings

def create_table_raw():
    print(f"Connecting to DB...")
    
    try:
        conn = psycopg2.connect(
            host=settings.POSTGRES_SERVER,
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            database=settings.POSTGRES_DB,
            port=settings.POSTGRES_PORT
        )
        cur = conn.cursor()
        
        sql = """
        CREATE TABLE IF NOT EXISTS projectinsight (
            id VARCHAR PRIMARY KEY,
            project_id VARCHAR REFERENCES project(id),
            insight_type VARCHAR DEFAULT 'EXECUTIVE_SUMMARY',
            title VARCHAR,
            content_markdown TEXT,
            metadata JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS ix_projectinsight_id ON projectinsight (id);
        CREATE INDEX IF NOT EXISTS ix_projectinsight_project_id ON projectinsight (project_id);
        """
        
        cur.execute(sql)
        conn.commit()
        print("Table 'projectinsight' created successfully using raw SQL.")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    create_table_raw()
