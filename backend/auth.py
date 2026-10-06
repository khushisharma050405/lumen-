import hashlib
import os
import datetime
from typing import Optional, Dict, Any
import jwt
from fastapi import HTTPException, Header

SECRET_KEY = os.getenv("VERSE_JWT_SECRET", "verse-secret-key-2026-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    if not salt:
        salt = os.urandom(16).hex()
    pwd_hash = hashlib.sha256((password + salt).encode('utf-8')).hexdigest()
    return pwd_hash, salt

def verify_password(plain_password: str, hashed_password: str, salt: str) -> bool:
    expected_hash, _ = hash_password(plain_password, salt)
    return expected_hash == hashed_password

# In-memory users store initialized with a default demo writer
USERS_DB: Dict[str, Dict[str, Any]] = {}

# Pre-seed demo user
demo_salt = "verse_seed_salt"
demo_hash, _ = hash_password("verse123", demo_salt)
USERS_DB["writer@verse.ai"] = {
    "id": "usr_writer_01",
    "email": "writer@verse.ai",
    "name": "Verse Writer",
    "hash": demo_hash,
    "salt": demo_salt,
    "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
}

def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.now(datetime.timezone.utc) + expires_delta
    else:
        expire = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid credentials token")

def get_current_user_from_header(authorization: Optional[str] = Header(None)) -> Optional[Dict[str, Any]]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    email = payload.get("sub")
    if not email or email not in USERS_DB:
        return None
    user = USERS_DB[email]
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"]
    }
