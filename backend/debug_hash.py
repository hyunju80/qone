from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

try:
    print("Attempting to hash 'password12'")
    h = pwd_context.hash("password12")
    print(f"Success: {h}")
except Exception as e:
    print(f"Error: {e}")
