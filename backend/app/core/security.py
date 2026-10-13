from datetime import datetime, timedelta, timezone
from jose import jwt
import bcrypt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from .config import settings
from .database import get_db
from ..models.models import User

bearer = HTTPBearer()

def hash_pw(p: str) -> str:
    # Truncate to 72 bytes if needed per bcrypt specification
    p_bytes = p.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(p_bytes, salt).decode('utf-8')

def verify_pw(p: str, h: str) -> bool:
    try:
        p_bytes = p.encode('utf-8')[:72]
        h_bytes = h.encode('utf-8')
        return bcrypt.checkpw(p_bytes, h_bytes)
    except Exception:
        return False

def create_token(sub: str, role: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode({"sub": str(sub), "role": role, "exp": exp}, settings.secret_key, algorithm=settings.algorithm)

def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)) -> User:
    try:
        payload = jwt.decode(creds.credentials, settings.secret_key, algorithms=[settings.algorithm])
        uid = int(payload.get("sub"))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.get(User, uid)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def require_roles(*roles):
    def _check(user: User = Depends(get_current_user)):
        user_role = user.role.value if hasattr(user.role, "value") else str(user.role)
        if user_role not in roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return _check
