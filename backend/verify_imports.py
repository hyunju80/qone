try:
    from app.db.base import Base
    from app.models.user import User
    print("Imports successful")
except ImportError as e:
    print(f"ImportError: {e}")
except Exception as e:
    print(f"Error: {e}")
