from app import db
from fastapi import HTTPException, Depends
from passlib.context import CryptContext
import jwt
from datetime import datetime, timedelta
from app.config import settings
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from bson import ObjectId

auth_scheme = HTTPBearer()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SECRET_KEY = settings.JWT_SECRET

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(
    user_id: str,
    role: str,
    email: str,
    expires_minutes=settings.JWT_EXPIRES_MINUTES,
) -> str:
    try:
        expiry = int(expires_minutes)
    except (ValueError, TypeError):
        expiry = settings.JWT_EXPIRES_MINUTES

    payload = {
        "sub": user_id,
        "role": role,
        "email": email,
        "exp": datetime.utcnow() + timedelta(minutes=expiry)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

def decode_token(token: str):
    if not token or token.count('.') != 2:
        raise HTTPException(status_code=401, detail="Invalid token format")
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.DecodeError:
        raise HTTPException(status_code=401, detail="Token decode error")
    
def get_current_user(token: HTTPAuthorizationCredentials = Depends(auth_scheme)):
    payload = decode_token(token.credentials)
    return payload['sub'], payload['role'], payload.get('email')

def verify_token(token: HTTPAuthorizationCredentials = Depends(auth_scheme)):
    try:
        payload = decode_token(token.credentials)
        user_id = payload['sub']
        return user_id
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_role(user_id: str, allowed_roles: list[str]):
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user or user["role"] not in allowed_roles:
        raise HTTPException(status_code=403, detail="Access denied")
    return user