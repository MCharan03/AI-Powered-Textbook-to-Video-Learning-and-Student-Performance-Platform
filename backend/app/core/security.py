from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from .config import settings
from .database import get_db
from ..models.models import User, Student, Parent, Teacher, Role

# auto_error=False allows returning explicit 401 status for missing or malformed tokens
bearer = HTTPBearer(auto_error=False)


def hash_pw(p: str) -> str:
    # Truncate to 72 bytes if needed per bcrypt specification
    p_bytes = p.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(p_bytes, salt).decode("utf-8")


def verify_pw(p: str, h: str) -> bool:
    try:
        p_bytes = p.encode("utf-8")[:72]
        h_bytes = h.encode("utf-8")
        return bcrypt.checkpw(p_bytes, h_bytes)
    except Exception:
        return False


def create_token(sub: str, role: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    role_str = role.value.lower() if hasattr(role, "value") else str(role).lower()
    return jwt.encode({"sub": str(sub), "role": role_str, "exp": exp}, settings.secret_key, algorithm=settings.algorithm)


def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer), db: Session = Depends(get_db)) -> User:
    if not creds or not creds.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, settings.secret_key, algorithms=[settings.algorithm])
        sub = payload.get("sub")
        if sub is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        uid = int(sub)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.get(User, uid)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account is inactive")
    return user


def require_roles(*roles):
    allowed_roles = [r.lower() for r in roles]

    def _check(user: User = Depends(get_current_user)) -> User:
        user_role = user.role.value.lower() if hasattr(user.role, "value") else str(user.role).lower()
        if user_role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return user

    return _check


def resolve_student_for_user(user: User, db: Session) -> Optional[Student]:
    """Helper to retrieve Student record from User model."""
    if user.student:
        return user.student
    return db.query(Student).filter(Student.user_id == user.id).first()


def resolve_teacher_for_user(user: User, db: Session) -> Optional[Teacher]:
    """Helper to retrieve Teacher record from User model."""
    if user.teacher:
        return user.teacher
    return db.query(Teacher).filter(Teacher.user_id == user.id).first()


def resolve_parent_for_user(user: User, db: Session) -> Optional[Parent]:
    """Helper to retrieve Parent record from User model."""
    if user.parent:
        return user.parent
    return db.query(Parent).filter(Parent.user_id == user.id).first()
